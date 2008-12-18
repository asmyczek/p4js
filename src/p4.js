// --------------------------------------------------------------------------
// Monadic JavaScript parser combinator library
// inspired by Graham Hutton's "Programming in Haskell - Functional Parsers"
//
// 
// A Parser is a function from an input string to a type and the not
// parsed rest of the input: input -> { value, input }.
//
// 
// Copyright Adam Smyczek 2008.
// Licensed under New BSD (LICENSE.txt).
// --------------------------------------------------------------------------

var P4JS = function() {

  // -- Some utility function -----------------------------------------------
 
  var isDigit    = function(c) { return ((c >= "0") && (c <= "9")); };
  var isLower    = function(c) { return ((c >= "a") && (c <= "z")); };
  var isUpper    = function(c) { return ((c >= "A") && (c <= "Z")); };
  var isAlpha    = function(c) { return isLower(c) || isUpper(c); };
  var isAlphaNum = function(c) { return isAlpha(c) || isDigit(c); };
  var isSpace    = function(c) { return ((c === ' ') || (c === '\t')); };
  var isEqual    = function(a, b) { return a === b };

  // Function curring, a must ;)
  var curry = function(funk) {
    return function() {
      var args = Array.prototype.slice.apply(arguments);
      return function () {
        return funk.apply(null, 
            args.concat(Array.prototype.slice.apply(arguments)));
      };
    };
  };

  // Helper function to create the parser result, an object that contains
  // the parsed value and the rest of the input.
  var mkResult = function(value, rest) {
    return { value : value, input : rest };
  }

  // -- Monadic operators ---------------------------------------------------
 
  // return
  var _return = function(value) {
    return function (input) { return mkResult(value, input); };
  };

  // failure
  var _failure = function (input) { return undefined; };

  // bind (>>=)
  var _bind = function(p, f) {
    return function(input) {
      var v = parse(p, input);
      if (v === undefined) {
        return undefined;
      } else {
        return parse(f(v.value), v.input);
      }
    };
  };

  // Recursive bind used by the _do function.
  var _rec_bind = function(parsers, retfunk, results) {
    if (parsers.length > 0) {
      return _bind(parsers[0], 
        function(v) { 
          return _rec_bind(parsers.slice(1), retfunk, results.concat(v));
        });
    } else {
      return retfunk.apply(null, results);
    }
  };

  // Do function
  var _do = function() {
    var parsers = Array.prototype.slice.apply(arguments),
        bind_parser = function(f) { return _rec_bind(parsers, f, []); };
    return {
        doReturn : function(f) { return bind_parser(function() { return _return(f.apply(null, arguments)); }); },
        doResult : function(f) { return bind_parser(f); },
        doFail   : function(f) { return _failure; }
    };
  };

  // -- Basic parser combinators --------------------------------------------

  // Consume one char from input.
  var _item = function (input) {
    return (input === undefined)? undefined : 
      mkResult(input[0], input.slice(1));
  };

  // Parses next item if it satisfies f, otherwise fails.
  var _sat = function(f) {
    return _do(_item).doResult(function(v) { return (f(v))? _return(v) : _failure; });
  };

  // Try p1 and if it fails use p2 to parse input.
  var _choice = function(p1, p2) {
    return function(input) {
      var v = parse(p1, input);
      return (v !== undefined)? v : parse(p2, input);
    };
  };

  // Parses next input if it satisfies v, otherwise fails.
  var _char = function(v) {
    return _sat(curry(isEqual)(v));
  };
  
  // Same as _char but for a string
  var _string = function(str) {
    if (str.length > 0) {
        var c  = str.charAt(0),
            cs = str.substring(1);
        return _do(_char(c), _string(cs)).doReturn(function(a, b) { return a + b; });
    };
    return _return("");
  };

  // 
  var _many = function(p) {
    return _choice(_many1(p), _return(""));
  };

  // 
  // Shame, JavaScript is not lazy, otherwise _many1 could be implemented 
  // simple as:
  // _do(p, _return("")).doReturn(function(a, b) { return a.concat(b); });
  var _many1 = function(p) {
    return function(input) {
      var v = parse(p, input);
      return (v === undefined)? undefined : 
        parse(_do(_many(p)).doReturn(function(a) { return v.value + a; }), v.input);
    };
  };

  // -- Tokenizer -----------------------------------------------------------

  // Truncates leading spaces from a input
  var _space = _do(_many(_sat(isSpace))).doReturn(function(a) { return ""; });

  // Ignore spacing around to parsed input
  var _token = function(p) {
    return _do(_space, p, _space).doReturn(function(a,b,c) { return b; });
  };

  // Parse next char sequence
  var _seq = _token(_many(_sat(isAlphaNum)));

  // Parse next symbol str
  var _symbol = function(str) {
    return _token(_string(str));
  };

  // Parse new line
  var _newLine = _choice(_symbol("\n\r"), _symbol("\n"));

  // -- Parser executor functions -------------------------------------------

  var parse = function (parser, input) {
    return parser(input);
  };

  // -- Parser object exporting public functions ----------------------------
 
  var p = { }

  p._return   = _return;
  p._failure  = _failure;

  p._do       = _do;

  p._item     = _item;
  p._digit    = _sat(isDigit);
  p._alpha    = _sat(isAlpha);
  p._alphanum = _sat(isAlphaNum);
  p._lower    = _sat(isLower);
  p._upper    = _sat(isUpper);

  p._choice   = _choice;
  p._char     = _char
  p._string   = _string
  p._many     = _many;
  p._many1    = _many1;

  p._space    = _space;
  p._token    = _token;
  p._seq      = _seq;
  p._symbol   = _symbol;
  p._newLine  = _newLine;

  p.parse = parse;

  return p;

}();

