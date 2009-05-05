var P4JS = $P = function() {

  var createValueStack = function() {
    var stack = [[]];

    var assertNotEmpty = function() {
      if (stack.length === 0) throw "Invalid parser, value stack is empty!";
    };

    var s = {};
    s.top       = function()  { assertNotEmpty(); return stack[stack.length - 1]; };
    s.pushValue = function(v) { assertNotEmpty(); return stack[stack.length - 1].push(v); };
    s.push      = function()  { stack.push([]); return this; };
    s.pop       = function()  { assertNotEmpty(); return stack.pop(); };
    return s;
  };

  var createState = function(input, data, line, column) {
    var s = { input    : input
            , line     : line || 1 
            , column   : column || 0
            , data     : data };
    s.nextLine = function()  { this.line++; this.column = 0; };
    s.nextChar = function () { this.column++; };
    return s;
  };

  var createContext = function(lib) {

    var parser_stack = [];

    var C = function () {};
    C.prototype = lib;
    var c = new C();

    c.state = undefined;

    c.pushParser = function(f) {
      parser_stack.push(f);
      return this;
    };

    c.runParser = function(p, vs) {
      var v = p.parseWithState(createState(this.state.input, this.state.data, this.state.line, this.state.column));
      vs.pushValue(v[0]);
      this.state = p.state;
    };

    c.popValueStack = function(f) {
      return this.pushParser(function(vs) { 
        var rv = vs.pop();
        var v = (!f)? rv : f.apply(this, [rv]);
        if (v !== undefined) {
          vs.pushValue(v);
        }
      });
    },

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

    c.isDigit    = function(ch)    { return ((ch >= "0") && (ch <= "9")); };
    c.isLower    = function(ch)    { return ((ch >= "a") && (ch <= "z")); };
    c.isUpper    = function(ch)    { return ((ch >= "A") && (ch <= "Z")); };
    c.isAlpha    = function(ch)    { return this.isLower(ch) || this.isUpper(ch); };
    c.isAlphaNum = function(ch)    { return this.isAlpha(ch) || this.isDigit(ch); };
    c.isSpace    = function(ch)    { return ((ch === ' ') || (ch === '\t')); };

    c.parse = function(input, data) {
      return this.parseWithState(createState(input, data));
    };

    c.parseWithState = function(state) {
      this.state = state;
      var vs = createValueStack();
      for (var i = 0; i < parser_stack.length; i++) {
        parser_stack[i].apply(this, [vs]);
      }
      return vs.top();
    };

    c.register = function(name) {
      if (P4JS.lib[name] !== undefined) {
        throw "Parser function '" + name + "' exists already.";
      }

      var ps = [];
      for (var i = 0; i < parser_stack.length; i++) {
        ps.push(parser_stack[i]);
      }
      parser_stack = null;

      P4JS.lib[name] = function() {
        for (var j = 0; j < ps.length; j++) {
          this.pushParser(ps[j]);
        }
        return this;
      };
    };

    c.input = function() {
      return this.state.input;
    };

    return c;
  };

  var P = function() {};
  P.prototype = createContext(P4JS.lib);
  return new P();
};


P4JS.lib = {

  return : function(v) {
    return this.pushParser(function(vs) { vs.pushValue(v); });
  },

  failure : function(error_message) {
    return this.pushParser(function(vs) { throw this.error(error_message); });
  },

  item : function() {
    return this.pushParser(function(vs) { 
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

  sat : function(f, error_msg) {
    return this.do().item().reduce(function(rv) {
      if (f.apply(this, [rv[0]])) { 
        return rv[0]; 
      } else { 
        throw this.error(error_msg);
      }
    });
  },

  digit 		: function () { return this.sat(this.isDigit, 	 'not a digit!'); },
  lower 		: function () { return this.sat(this.isLower, 	 'not a lower char!'); },
  upper 		: function () { return this.sat(this.isUpper, 	 'not an upper char!'); },
  alpha 		: function () { return this.sat(this.isAlpha, 	 'not an alpha char!'); },
  alphanum	: function () { return this.sat(this.isAlphaNum, 'not an alpha-num char!'); },
  space 		: function () { return this.sat(this.isSpace, 	 'not a space char!'); },

  choice : function() {
    var ps = Array.prototype.slice.apply(arguments);
    return this.pushParser(function(vs) { 
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

  char : function(c) { 
    return this.sat(function(i) { return (i == c); }, "Expecting a '" + c + "'!"); 
  },

  string : function(s) {
    var p = this.do();
    for (var i = 0; i < s.length; i++) p = p.char(s[i]);
    p.join();
    return this;
  },

  bind : function(p) {
    return this.pushParser(function(vs) { this.runParser(p, vs); });
  },

  do : function() { return this.pushParser(function(vs) { vs.push(); }) },

  reduce : function(f) { return this.popValueStack(f); },

  join : function(c, f) { return this.popValueStack(function(rv) { 
      if (rv.length > 0) {
        var v = rv.join(c || ''); 
        return (!f)? v : f(v);
      }
      return undefined;
    });
  },

  int : function(f) {
    return this.popValueStack(function(rv) { 
      if (rv.length > 0) {
        var v = parseInt(rv.join(''));
        return (!f)? v : f(v);
      };
      return undefined;
    });
  },

  many : function(p) {
    return this.pushParser(function(vs) { try { while (true) this.runParser(p, vs); } catch (e) { } });
  },

  many1 : function(p) {
    return this.bind(p).many(p);
  },

  oneOf : function(match) {
    return this.sat(function(c) { return match.indexOf(c) != -1; }, "Not OneOf '" + match + "'!");
  },

  noneOf : function(match) {
    return this.sat(function(c) { return match.indexOf(c) == -1; }, "Not NoneOf '" + match + "'!");
  },

  // -- Tokenizer -----------------------------------------------------------

  space : function() {
    return this.do().many($P().sat(this.isSpace)).reduce(function(rv) { return undefined; });
  },

  token : function(p) { 
    return this.do().space().bind(p).space().reduce(function(rv) { return rv[0]; });
  },

  seq : function() {
    return this.token($P().do().many($P().sat(this.isAlphaNum, "Not an AlphaNum!")).join());
  },

  symbol : function(str) {
    return this.token($P().string(str));
  },

  eol : function() { return this.symbol('\n'); },

  eoi : function() {
    return this.pushParser(function(vs) { if (this.state.input && this.state.input !== '') throw this.error("Not EOI!"); });
  }

};


