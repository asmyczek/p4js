// --------------------------------------------------------------------------
// Monadic parser combinator library for JavaScript
// inspired by Graham Hutton's "Programming in Haskell - Functional Parsers"
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

  // Join arguments usefull for many... parsers
  var joinArgs = function() {
    var args = Array.prototype.slice.apply(arguments); 
    return args.join("");
  };

  // Convert function arguments to an array
  var args2Array = function() {
    return Array.prototype.slice.apply(arguments);
  };

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

  // -- Monadic operators ---------------------------------------------------
 
  // return
  var _return = function(value) {
    return function (input) { return { value : value, input : input } };
  };

  // failure
  var _failure = function (input) { return undefined; };

  // bind
  var _bind = function(p, f) {
    return function(input) {
      var v = parse(p, input);
      return (v === undefined)? undefined : parse(f(v.value), v.input);
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

  // Do function takes parsers as arguments in the order of execution
  // and returns an object that provides following functions:
  // - doReturn(f) : applies the function f to the result array of all parsers
  //                 and returns the parser.
  // - doResult(f) : applies the function f to the array result, but do not return
  //                 the parser. The function f has to return _return(..) or _failure;
  // - doFail()    : forces the parser to fail, not very common.
  //
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
      parse(_return(input[0]), input.slice(1));
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

  // Many combinator
  var _many = function(p) {
    return _choice(_many1(p), _return([]));
  };

  // Many1
  // JavaScript is not lazy, so the inner parser function is required
  var _many1 = function(p) {
    return function(input) {
      var mp = _do(p, _many(p)).doReturn(args2Array);
      return parse(mp, input);
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

  // -- Heigher abstraction level combinators -------------------------------

  // try p until b matches
  var _manyTill = function(p, b) {
    return function(input) {
      var br = parse(b, input);
      if (br === undefined) {
        return parse(_do(p, _manyTill(p, b)).doReturn(args2Array), input);
      } else {
        return parse(_return([]), input);
      }
    };
  };

  // -- Parser executor functions -------------------------------------------
  var parse = function (parser, input) {
    return parser(input);
  };

  // -- The Parser object exports public functions --------------------------
 
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

  p._manyTill = _manyTill;

  // utils
  p.joinArgs    = joinArgs;
  p.args2Array = args2Array;

  p.parse = parse;

  return p;

}();

