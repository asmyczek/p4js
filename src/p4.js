// --------------------------------------------------------------------------
// Monadic parser library for JavaScript
//
// Copyright Adam Smyczek 2009.
// All rights reserved.
// 
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
// 
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
// 
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
// 
//     * Neither the name the author nor the names of other
//       contributors may be used to endorse or promote products derived
//       from this software without specific prior written permission.
// 
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
// --------------------------------------------------------------------------

var P4JS = $P = function() {

  // ------------------------------------------------------------------------
  // Create result stack
  //
  var createResultStack = function() {
    // Private stack reference
    var stack  = [[]],
        backup = [];

    var assertNotEmpty = function() {
      if (stack.length === 0) { throw "Invalid parser, value stack is empty!"; }
    };
  
    var printArray = function(arr) {
      var r = '';
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && ({}.toString.call(arr[i]).indexOf("Array")) > -1) {
          r += printArray(arr[i]);
        } else {
          r += arr[i];
        }
        if (i + 1 < arr.length) { r += ", "; }
      }
      return '[' + r + ']';
    };

    var copyStack = function() {
      var r = [];
      for (var i = 0; i < stack.length; i++) { r[i] = stack[i].slice(); }
      return r;
    };

    var s = {};
    s.top       = function()  { assertNotEmpty(); return stack[stack.length - 1]; };
    s.pushValue = function(v) { assertNotEmpty(); stack[stack.length - 1].push(v); };
    s.push      = function()  { stack.push([]); return s; };
    s.pop       = function()  { assertNotEmpty(); return stack.pop(); };
    s.backup    = function()  { backup.push(copyStack()); };
    s.restore   = function()  { if (backup.length === 0) { throw "No result stack backup!"; }
                                stack = backup.pop(); };
    s.release   = function()  { backup.pop(); };
    s.print     = function()  { return printArray(stack); };
    return s;
  };
 
  // ------------------------------------------------------------------------
  // Create the internal parse state
  //
  var createState = function(input, data) {
    var backup;

    var s = { input    : input,
              line     : 1,
              column   : 1,
              data     : data };
    s.nextLine = function() { this.line++; this.column = 0; };
    s.nextChar = function() { this.column++; };
    s.backup   = function() { backup = createState(this.input, this.data); 
                              backup.line = this.line;
                              backup.column = this.column; };
    s.restore  = function() { if (!backup) { throw "No state backup!"; }
                              this.input  = backup.input;
                              this.data   = backup.data;
                              this.line   = backup.line;
                              this.column = backup.column; };
    return s;
  };

  // ------------------------------------------------------------------------
  // The parser constructor factory
  //
  var createContext = function(lib) {

    // Private parser stack
    var parser_stack = [];

    // Create parser with the passed lib as prototype
    var C = function () {};
    C.prototype = lib;
    var c = new C();

    // The parser state
    c.state = undefined;

    // Bind pushes parser function to stack
    c.bind = function(f) {
      parser_stack.push(f);
      return this;
    };

    // Helper function to run parsers passed as arguments e.g. to many()
    // If p fails, state and result state are reseted
    c.runParser = function(p, rs) {
        p.parseWithState(this.state, rs);
    };

    // Helper function used by do-reduce
    c.popValueStack = function(f) {
      return this.bind(function(rs) { 
        var rv = rs.pop();
        var v = (!f)? rv : f.apply(this, [rv, rs]);
        if (v !== undefined) {
          rs.pushValue(v);
        } 
      });
    };

    // Main parse method creates new parse state object
    c.parse = function(input, data) {
      var rs = createResultStack();
      this.parseWithState(createState(input, data), rs);
      return rs.top();
    };

    // Helper method used by runParser() 
    // The passed state is a state copy of the caller parser
    c.parseWithState = function(state, rs) {
      this.state = state;
      for (var i = 0; i < parser_stack.length; i++) {
        parser_stack[i].apply(this, [rs]);
      }
    };

    // Register this parser in the default lib under argument name.
    // Returns false if a parser for name exists already, true otherwise.
    c.register = function(name) {
      var cp;
      if (P4JS.lib[name] !== undefined) {
        cp = P4JS.lib[name];
      }

      var ps = [];
      for (var i = 0; i < parser_stack.length; i++) {
        ps.push(parser_stack[i]);
      }
      parser_stack = null;

      P4JS.lib[name] = function() {
        for (var j = 0; j < ps.length; j++) {
          this.bind(ps[j]);
        }
        return this;
      };
      return cp;
    };

    // Return not consumed input
    c.input = function() {
      return this.state.input;
    };

    // Return data passed to parser
    c.data = function() {
      return this.state.data;
    };

    return c;
  };

  // Create a parser object with the parser lib as prototype
  var P = function() {};
  P.prototype = createContext(P4JS.lib);
  return new P();
};


// ------------------------------------------------------------------------
// A library 
//
P4JS.lib = {

  // The monadic operators
  // return and failure
  return : function(v) {
    return this.bind(function(rs) { rs.pushValue(v); });
  },

  failure : function(error_message) {
    return this.bind(function(rs) { throw this.error(error_message); });
  },

  // Read one char and push on the current stack
  item : function() {
    return this.bind(function(rs) { 
      var s = this.state;
      if (!s.input || s.input === '') {
        throw this.error("Empty input!");
      } else {
        var ch = s.input[0];
        rs.pushValue(ch); 
        s.input = s.input.slice(1); 
        if (ch === "\n") { s.nextLine() } else { s.nextChar(); }
      }
    });
  },

  // Some helpers for sat() combinator
  isDigit    : function(ch)    { return ((ch >= "0") && (ch <= "9")); },
  isLower    : function(ch)    { return ((ch >= "a") && (ch <= "z")); },
  isUpper    : function(ch)    { return ((ch >= "A") && (ch <= "Z")); },
  isAlpha    : function(ch)    { return this.isLower(ch) || this.isUpper(ch); },
  isAlphaNum : function(ch)    { return this.isAlpha(ch) || this.isDigit(ch); },
  isSpace    : function(ch)    { return ((ch === ' ') || (ch === '\t')); },

  // Read next char from input and validate it using f
  // Throws exception if f() returns false
  sat : function(f, error_msg) {
    return this.do().item().reduce(function(rv) {
      if (f.apply(this, [rv[0]])) { 
        return rv[0]; 
      } else { 
        throw this.error(error_msg);
      }
    });
  },

  // Some useful char parsers based on sat()
  digit 		: function () { return this.sat(this.isDigit, 	 'not a digit!'); },
  lower 		: function () { return this.sat(this.isLower, 	 'not a lower char!'); },
  upper 		: function () { return this.sat(this.isUpper, 	 'not an upper char!'); },
  alpha 		: function () { return this.sat(this.isAlpha, 	 'not an alpha char!'); },
  alphanum	: function () { return this.sat(this.isAlphaNum, 'not an alpha-num char!'); },
  space 		: function () { return this.sat(this.isSpace, 	 'not a space char!'); },

  // Try to apply parsers on the current input in the passed order
  // Throws exception if all parser fail to consume the input
  choice : function() {
    var ps = Array.prototype.slice.apply(arguments);
    return this.bind(function(rs) { 
      for (var i = 0; i < ps.length; i++) {
        try {
          rs.backup();
          this.state.backup();
          this.runParser(ps[i], rs);
          rs.release();
          return;
        } catch (e) {
          if (!e.type || e.type !== "parse_error") { throw e; }
          rs.restore();
          this.state.restore();
        }
      }
      throw this.error("No parser match for 'choice'!");
    });
  },

  // Try parse a and b in case a fails.
  // Throws exception if parser b fails as well.
  // If b not defined, fail safe with $P().return().
  try : function(a, b) {
    return this.choice(a, b || $P().return());
  },

  // Read expected char from input and throw exception if char does not match
  char : function(c) { 
    return this.sat(function(i) { return (i == c); }, "Expecting a '" + c + "'!"); 
  },

  // Read expected string from input and throw exception if string does not match
  string : function(s) {
    var p = this.do();
    for (var i = 0; i < s.length; i++) { p = p.char(s[i]); }
    p.join();
    return this;
  },

  // Pushes a new array on the result stack
  // All values are pushed to the new array and
  // combined using the reduce function, so
  // every do operator must be followed by a matching reduce.
  // All combinators can be chained between do-reduce
  // or passed as argument to do(), if not defined
  // in the default lib.
  do : function() { 
    this.bind(function(rs) { rs.push(); });
    var ps = Array.prototype.slice.apply(arguments);
    for (var i = 0; i < ps.length; i++) {
      (function(t, p) { t.bind(function(rs) { t.runParser(p, rs); }); }(this, ps[i]));
    }
    return this;
  },

  // General reduce operator with custom function.
  // The function takes the result array from the matching 
  // do operator as argument and the optional result stack
  // for mainly debug purpose.
  reduce : function(f) { return this.popValueStack(f); },

  // Custom reduce, joins the result values using c and
  // applies function f to the result. Both arguments
  // are optional.
  join : function(c, f) { return this.popValueStack(function(rv, rs) { 
      if (rv.length > 0) {
        var v = rv.join(c || ''); 
        return (!f)? v : f.apply(this, [v, rs]);
      }
      return undefined;
    });
  },

  // Returns element at the index i form result array
  // and applies function f on it
  element : function(i, f) { return this.popValueStack(function(rv, rs) { 
      return (!f)? rv[i] : f.apply(this, [rv[i], rs]);
    });
  },

  // Custom reduce that joins and converts the result to integer
  // The optional function f is applied to the resulting integer
  int : function(f) {
    return this.popValueStack(function(rv, rs) { 
      if (rv.length > 0) {
        var v = parseInt(rv.join(''));
        return (!f)? v : f.apply(this, [v, rs]);
      }
      return undefined;
    });
  },

  // Apply parser p as many times as possible
  many : function(p) {
    return this.bind(function(rs) { 
        try { 
          while (true) {
            rs.backup();
            this.state.backup();
            this.runParser(p, rs); 
            rs.release();
          }
        } catch (e) { 
          if (!e.type || e.type !== "parse_error") { throw e; }
          rs.restore();
          this.state.restore();
        }
    });
  },

  // Apply parser p at least once
  // Throws exception if first application fails
  many1 : function(p) {
    return this.attach(p).many(p);
  },

  // Consume next input char if match list contains it,
  // throw an exception otherwise
  oneOf : function(match) {
    return this.sat(function(c) { return match.indexOf(c) != -1; }, "Not OneOf '" + match + "'!");
  },

  // Consume next input char if match list does not contain it,
  // throw an exception otherwise
  noneOf : function(match) {
    return this.sat(function(c) { return match.indexOf(c) == -1; }, "Not NoneOf '" + match + "'!");
  },

  // Execute external defined
  attach : function(p) {
    return this.bind(function(rs) { this.runParser(p, rs); });
  },

  // -- Tokenizer --

  // Consume many space chars
  spaces : function() {
    return this.do().many($P().space()).reduce(function(rv) { return undefined; });
  },

  // Trim spaces before and after the input parsed by p
  token : function(p) { 
    return this.do().spaces().attach(p).spaces().element(0);
  },

  // Parse alpha-num token
  seq : function() {
    return this.token($P().do().many1($P().alphanum()).join());
  },

  // Read expected symbol or throw an exception
  symbol : function(str) {
    return this.token($P().string(str));
  },

  // Parse end of line
  eol : function() { return this.symbol('\n'); },

  // Check for end of input
  eoi : function() {
    return this.bind(function(rs) { 
      if (this.state.input && this.state.input !== '') { throw this.error("Not parsed input '" + this.input() + "'!"); }
    });
  },

  // Some helpers, overwrite if required

  // Basic logging attaches log message to element with elementId
  // or default 'p4js_log' if elementId not defined
  log : function(msg, elementId) {
    var l = document.getElementById(elementId || 'p4js_log');
    if (l) { l.innerHTML += "<br/>" + msg; }
  },

  // Create parser error object thrown in exceptions
  error : function(err) {
    return { type    : "parse_error",
             message : err,
             state   : this.state,
             print   : function() {
             return "Error: " + err +
                    " (line " + this.state.line + ", column " + this.state.column + ")";
           } };
  }

};

