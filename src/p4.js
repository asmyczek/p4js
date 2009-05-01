var P4JS = $P = function() {

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
    var value_stack  = [];

    var pushValue = function(v) {
      value_stack[value_stack.length - 1].push(v);
    };

    var C = function () {};
    C.prototype = lib;
    var c = new C();

    c.state = undefined;

    c.pushValue = pushValue;

    c.addValueStack = function() {
      return this.pushParser(function() { value_stack.push([]); });
    };

    c.reduceValueStack = function(f) {
      return this.pushParser(function() { 
        var v = f(value_stack.pop());
        if (v !== undefined) pushValue(v);
      });
    };

    c.pushParser = function(f) {
      parser_stack.push(f);
      return this;
    };

    c.runParser = function(p) {
      p.parseWithState(createState( this.state.input, this.state.data, this.state.line, this.state.column));
      this.pushValue(p.value()); 
      this.state = p.state;
    };

    c.error = function(err) {
      return { type    : "parse_error"
             , message : err
             , state   : this.state
             , print   : function() {
               return "Parser Error: " + err + " at (line " + this.state.line + ", column " + this.state.column + ")";
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
      value_stack = [];
      value_stack.push([]);
      for (var i = 0; i < parser_stack.length; i++) {
        parser_stack[i].apply(this);
      }
      return this;
    };

    c.value = function() {
      return value_stack[0];
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

  _return : function(v) {
    return this.pushParser(function() { this.pushValue(v); });
  },

  _item : function() {
    return this.pushParser(function() { 
      var s = this.state;
      if (!s.input || s.input === '') {
        throw this.error("Empty input!");
      } else {
        var ch = s.input[0];
        this.pushValue(ch); 
        s.input = s.input.slice(1); 
        (ch === "\n")? s.nextLine() : s.nextChar();
      }
    });
  },

  _sat : function(f, error_msg) {
    var that = this;
    var comp = function(vs) { 
        if (f.apply(that, [vs[0]])) { 
          return vs[0]; 
        } else { 
          throw that.error(error_msg);
        }
      };
    return this._do()._item().reduce(comp);
  },

  _digit 		: function () { return this._sat(this.isDigit, 	 'not a digit!'); },
  _lower 		: function () { return this._sat(this.isLower, 	 'not a lower char!'); },
  _upper 		: function () { return this._sat(this.isUpper, 	 'not an upper char!'); },
  _alpha 		: function () { return this._sat(this.isAlpha, 	 'not an alpha char!'); },
  _alphanum	: function () { return this._sat(this.isAlphaNum, 'not an alpha-num char!'); },
  _space 		: function () { return this._sat(this.isSpace, 	 'not a space char!'); },

  _choice : function() {
    var ps = Array.prototype.slice.apply(arguments);
    return this.pushParser(function() { 
      for (var i = 0; i < ps.length; i++) {
        try {
          this.runParser(ps[i]);
          return;
        } catch (e) {
          if (!e.type || e.type !== "parse_error") throw e;
        }
      }
      throw this.error("No parser match in 'choice'!");
    });
  },

  _char : function(c) { 
    return this._sat(function(i) { return (i == c); }, "Expecting a '" + c + "'!"); 
  },

  _string : function(s) {
    var p = this._do();
    for (var i = 0; i < s.length; i++) p = p._char(s[i]);
    p.join();
    return this;
  },

  bind : function(p) {
    return this.pushParser(function() { this.runParser(p); });
  },

  _do : function() { return this.addValueStack(); },

  reduce : function(f) { return this.reduceValueStack(f); },

  join : function(c) { return this.reduceValueStack(function(vs) { return vs.join(c || ''); }); },

  int : function(f) {
    return this.reduceValueStack(function(vs) { 
      var v = parseInt(vs.join(''));
      return (!f)? v : f(v);
    });
  },

  _many : function(p) {
    return this.pushParser(function() { try { while (true) this.runParser(p); } catch (e) { } });
  },

  _many1 : function(p) {
    return this.bind(p)._many(p);
  },

  _manyTill : function(p, b) {
    var that = this;
    var rec = function(p, b) {
      try {
        b.parse(that.state.input);
        return;
      } catch (e) {
        that.runParser(p);
        rec(p, b);
      }
    };
    return this.pushParser(function() { rec(p, b); });
  },

  _oneOf : function(match) {
    return this._sat(function(c) { return match.indexOf(c) != -1; }, "Not OneOf '" + match + "'!");
  },

  _noneOf : function(match) {
    return this._sat(function(c) { return match.indexOf(c) == -1; }, "Not NoneOf '" + match + "'!");
  },

  // -- Tokenizer -----------------------------------------------------------

  _space : function() {
    return this._do()._many($P()._sat(this.isSpace)).reduce(function(a) { return undefined; });
  },

  _token : function(p) { 
    return this._do()._space().bind(p)._space().reduce(function(vs) { return vs[0]; });
  },

  _seq : function() {
    return this._token($P()._do()._many($P()._sat(this.isAlphaNum, "Not an AlphaNum!")).join());
  },

  _symbol : function(str) {
    return this._token($P()._string(str));
  },

  _eol : function() { return this._symbol('\n'); },

  _eoi : function() {
    return this.pushParser(function() { if (this.state.input && this.state.input !== '') throw this.error("Not EOI!"); });
  }

};

