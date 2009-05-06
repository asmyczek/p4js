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
    var stack = [[]];

    var assertNotEmpty = function() {
      if (stack.length === 0) throw "Invalid parser, value stack is empty!";
    };

    var s = {};
    s.top       = function()  { assertNotEmpty(); return stack[stack.length - 1]; };
    s.pushValue = function(v) { assertNotEmpty(); stack[stack.length - 1].push(v); };
    s.push      = function()  { stack.push([]); return this; };
    s.pop       = function()  { assertNotEmpty(); return stack.pop(); };
    return s;
  };
 
  // ------------------------------------------------------------------------
  // Create the internal parse state
  //
  var createState = function(input, data, line, column) {
    var s = { input    : input
            , line     : line || 1 
            , column   : column || 0
            , data     : data };
    s.nextLine = function()  { this.line++; this.column = 0; };
    s.nextChar = function () { this.column++; };
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

    // The three monadic operators
    // return, bind and failure
    c.return = function(v) {
      return this.bind(function(vs) { vs.pushValue(v); });
    };

    c.bind = function(f) {
      parser_stack.push(f);
      return this;
    };

    c.failure = function(error_message) {
      return this.bind(function(vs) { throw this.error(error_message); });
    };

    // Helper function to run parsers passed as arguments e.g. to many()
    c.runParser = function(p, vs) {
      var v = p.parseWithState(createState(this.state.input, this.state.data, this.state.line, this.state.column));
      for (var i = 0; i < v.length; i++) vs.pushValue(v[i]);
      this.state = p.state;
    };

    // Helper function used by do-reduce
    c.popValueStack = function(f) {
      return this.bind(function(vs) { 
        var rv = vs.pop();
        var v = (!f)? rv : f.apply(this, [rv]);
        if (v !== undefined) {
          vs.pushValue(v);
        }
      });
    };

    // Create parser error object thrown in exceptions
    c.error = function(err) {
      return { type    : "parse_error"
             , message : err
             , state   : this.state
             , print   : function() {
               return "Parser Error: " + err + 
                      " at (line " + this.state.line + 
                      ", column " + this.state.column + ")";
             } };
    };

    // Some helpers for sat() combinator
    c.isDigit    = function(ch)    { return ((ch >= "0") && (ch <= "9")); };
    c.isLower    = function(ch)    { return ((ch >= "a") && (ch <= "z")); };
    c.isUpper    = function(ch)    { return ((ch >= "A") && (ch <= "Z")); };
    c.isAlpha    = function(ch)    { return this.isLower(ch) || this.isUpper(ch); };
    c.isAlphaNum = function(ch)    { return this.isAlpha(ch) || this.isDigit(ch); };
    c.isSpace    = function(ch)    { return ((ch === ' ') || (ch === '\t')); };

    // Main parse method creates new parse state object
    c.parse = function(input, data) {
      return this.parseWithState(createState(input, data));
    };

    // Helper method used by runParser() 
    // The passed state is a state copy of the caller parser
    c.parseWithState = function(state) {
      this.state = state;
      var vs = createResultStack();
      for (var i = 0; i < parser_stack.length; i++) {
        parser_stack[i].apply(this, [vs]);
      }
      return vs.top();
    };

    // Register this parser in the default lib under argument name.
    // Returns false if a parser for name exists already, true otherwise.
    c.register = function(name) {
      if (P4JS.lib[name] !== undefined) {
        return false;
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
      return true;
    };

    // Return not consumed input
    c.input = function() {
      return this.state.input;
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

  // Read one char and push on the current stack
  item : function() {
    return this.bind(function(vs) { 
      var s = this.state;
      if (!s.input || s.input === '') {
        throw this.error("Empty input!");
      } else {
        var ch = s.input[0];
        vs.pushValue(ch); 
        s.input = s.input.slice(1); 
        (ch === "\n")? s.nextLine() : s.nextChar();
      }
    });
  },

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
    return this.bind(function(vs) { 
      for (var i = 0; i < ps.length; i++) {
        try {
          this.runParser(ps[i], vs);
          return;
        } catch (e) {
          if (!e.type || e.type !== "parse_error") throw e;
        }
      }
      throw this.error("No parser match in 'choice'!");
    });
  },

  // Read expected char from input and throw exception if char does not match
  char : function(c) { 
    return this.sat(function(i) { return (i == c); }, "Expecting a '" + c + "'!"); 
  },

  // Read expected string from input and throw exception if string does not match
  string : function(s) {
    var p = this.do();
    for (var i = 0; i < s.length; i++) p = p.char(s[i]);
    p.join();
    return this;
  },

  // Pushes a new array on the result stack
  // All values are pushed to the new array and
  // combined using the reduce function.
  // Every do operator has to be followed by a matching reduce.
  do : function() { return this.bind(function(vs) { vs.push(); }) },

  // General reduce operator with custom function.
  // The function takes the result array from the matching 
  // do operator as argument.
  reduce : function(f) { return this.popValueStack(f); },

  // Custom reduce, joins the result values using c and
  // applies function f to the result. Both arguments
  // are optional.
  join : function(c, f) { return this.popValueStack(function(rv) { 
      if (rv.length > 0) {
        var v = rv.join(c || ''); 
        return (!f)? v : f(v);
      }
      return undefined;
    });
  },

  // Custom reduce that joins and converts the result to integer
  // The optional function f is applied to the resulting integer
  int : function(f) {
    return this.popValueStack(function(rv) { 
      if (rv.length > 0) {
        var v = parseInt(rv.join(''));
        return (!f)? v : f(v);
      };
      return undefined;
    });
  },

  // Apply parser p as many times as possible
  many : function(p) {
    return this.bind(function(vs) { try { while (true) this.runParser(p, vs); } catch (e) { } });
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
    return this.bind(function(vs) { this.runParser(p, vs); });
  },

  // -- Tokenizer --

  // Consume space chars
  space : function() {
    return this.do().many($P().sat(this.isSpace)).reduce(function(rv) { return undefined; });
  },

  // Trim spaces before and after the input parsed by p
  token : function(p) { 
    return this.do().space().attach(p).space().reduce(function(rv) { return rv[0]; });
  },

  // Parse alpha-num token
  seq : function() {
    return this.token($P().do().many($P().sat(this.isAlphaNum, "Not an AlphaNum!")).join());
  },

  // Read expected symbol or throw an exception
  symbol : function(str) {
    return this.token($P().string(str));
  },

  // Parse end of line
  eol : function() { return this.symbol('\n'); },

  // Check for end of input
  eoi : function() {
    return this.bind(function(vs) { if (this.state.input && this.state.input !== '') throw this.error("Not EOI!"); });
  }

};


