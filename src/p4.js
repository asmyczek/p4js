var $P = function() {

	var _parser_stack = [],
      _value_stack,
      _state; 

	var pushValue = function(v) {
		_value_stack[_value_stack.length - 1].push(v);
	};

	var addValueStack = function() {
		_value_stack.push([]);
	};

	var reduceValueStack = function(f) {
		pushValue(f(_value_stack.pop()));
	};

	var pushParser = function(f) {
		_parser_stack.push(f);
		return p;
	};

  var runParser = function(p) {
      pushValue(p.parse(_state.input, _state.data, _state.line, _state.column).value()); 
      _state.input = p.input();
      _state.line = p.line();
      _state.column = p.column();
  };

	var error = function(err) {
		return { type    : "parse_error"
           , message : err
           , line    : _state.line
           , column  : _state.column
           , input   : _state.input
           , print   : function() {
             return "Parser Error: " + err + " at (line " + _state.line + ", column " + _state.column + ")";
           }
          };
	};

	var curry = function(f) {
		return function() {
			var args = Array.prototype.slice.apply(arguments);
			return function () {
				return f.apply(null, args.concat(Array.prototype.slice.apply(arguments)));
			};
		};
	};

	// Sat functions
	var isDigit    = function(c)    { return ((c >= "0") && (c <= "9")); };
	var isLower    = function(c)    { return ((c >= "a") && (c <= "z")); };
	var isUpper    = function(c)    { return ((c >= "A") && (c <= "Z")); };
	var isAlpha    = function(c)    { return isLower(c) || isUpper(c); };
	var isAlphaNum = function(c)    { return isAlpha(c) || isDigit(c); };
	var isSpace    = function(c)    { return ((c === ' ') || (c === '\t')); };
	var isEqual    = function(a, b) { return a === b };

	// Parser
	var p = {

		_return : function(v) {
			return pushParser(function() { pushValue(v); });
		},

		_item : function() {
			return pushParser(function() { 
        if (!_state.input || _state.input === '') {
          throw error("Empty input!");
        } else {
          var ch = _state.input[0];
          pushValue(ch); 
          _state.input = _state.input.slice(1); 
          if (isEqual(ch, "\n")) {
            _state.line++;
            _state.column = 0;
          } else {
            _state.column++;
          }
        }
      });
		},

		_sat : function(f, error_msg) {
			return this._do()._item().reduce(function(vs) { if (f(vs[0])) { return vs[0]; } else { throw error(error_msg);} });
		},

		_digit 		: function () { return this._sat(isDigit, 	 'not a digit!'); },
		_lower 		: function () { return this._sat(isLower, 	 'not a lower char!'); },
		_upper 		: function () { return this._sat(isUpper, 	 'not an upper char!'); },
		_alpha 		: function () { return this._sat(isAlpha, 	 'not an alpha char!'); },
		_alphanum	: function () { return this._sat(isAlphaNum, 'not an alpha-num char!'); },
		_space 		: function () { return this._sat(isSpace, 	 'not a space char!'); },

		_choice : function() {
			var ps = Array.prototype.slice.apply(arguments);
			return pushParser(function() { 
        for (var i = 0; i < ps.length; i++) {
					try {
            runParser(ps[i]);
						return;
					} catch (e) {
					  if (!e.type || e.type !== "parse_error") throw e;
					}
        }
				throw error("No parser match in 'choice'!");
			});
		},

		_char : function(c) { 
			return this._sat(curry(isEqual)(c), "Expecting a '" + c + "'!"); 
		},

    _string : function(s) {
      var p = this._do();
      for (var i = 0; i < s.length; i++) p = p._char(s[i]);
      p.join();
      return this;
    },

		bind : function(p) {
			return pushParser(function() { runParser(p); });
		},

		_do : function() {
			return pushParser(function() { addValueStack(); });
		},

		reduce : function(f) {
			return pushParser(function() { reduceValueStack(f); });
		},

		join : function(c) {
			return pushParser(function() { reduceValueStack(function(vs) { return vs.join(c || ''); }); });
		},

		int : function(f) {
			return pushParser(function() { reduceValueStack(function(vs) { 
          var v = parseInt(vs.join(''));
          return (!f)? v : f(v);
				}); });
		},

    _many : function(p) {
      return pushParser(function() { try { while (true) runParser(p); } catch (e) { } });
    },

    _many1 : function(p) {
      return this.bind(p)._many(p);
    },

    _manyTill : function(p, b) {
      var rec = function(p, b) {
        try {
          b.parse(_state.input);
          return;
        } catch (e) {
          runParser(p);
          rec(p, b);
        }
      };
      return pushParser(function() { rec(p, b); });
    },

    _oneOf : function(match) {
      return this._sat(function(c) { return match.indexOf(c) != -1; }, "Not OneOf '" + match + "'!");
    },

    _noneOf : function(match) {
      return this._sat(function(c) { return match.indexOf(c) == -1; }, "Not NoneOf '" + match + "'!");
    },

		parse : function(input, data, line, column) {
      _state = { input  : input
               , line   : line || 1 
               , column : column || 0
               , data   : data };
			_value_stack  = [];
			addValueStack();
			for (var i = 0; i < _parser_stack.length; i++) {
				_parser_stack[i].call();
			}
			return this;
		},

		value : function() {
			return _value_stack[0];
		},

		input : function() {
			return _state.input;
		},

    line : function() {
      return _state.line;
    },

    column : function() {
      return _state.column;
    },

	};

	return p;
};

