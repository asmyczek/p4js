// --------------------------------------------------------------------------
// Monadic parser library for JavaScript
// inspired by Graham Hutton's "Programming in Haskell - Functional Parsers"
//
//
// Copyright Adam Smyczek 2008.
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

var P4JS = function() {

  // -- Some utility function -----------------------------------------------
 
  var isDigit    = function(c) { return ((c >= "0") && (c <= "9")); };
  var isLower    = function(c) { return ((c >= "a") && (c <= "z")); };
  var isUpper    = function(c) { return ((c >= "A") && (c <= "Z")); };
  var isAlpha    = function(c) { return isLower(c) || isUpper(c); };
  var isAlphaNum = function(c) { return isAlpha(c) || isDigit(c); };
  var isSpace    = function(c) { return ((c === ' ') || (c === '\t')); };
  var isEqual    = function(a, b) { return a === b };

  // Custom cons, adds a to the as array
  var cons = function(a, as) {
    var r = as.slice();
    r.unshift("");
    r[0] = a;
    return r;
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

  // Join arguments usefull for many... parsers
  var joinArgs = function(joinChar, f) {
    var jc = joinChar || "";
    return function() {
      var args = Array.prototype.slice.apply(arguments).join(jc);
      return (f === undefined)? args : f(args);
    };
  };

  // Cons arguments
  var consArgs = function(a, as) {
    return cons(a, as);
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
          var r = results.slice();
          r[results.length] = v;
          return _rec_bind(parsers.slice(1), retfunk, r);
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
    return (input === undefined || input === "")? undefined : 
      parse(_return(input[0]), input.slice(1));
  };

  // Parses next item if it satisfies f, otherwise fails.
  var _sat = function(f) {
    return _do(_item).doResult(function(v) { return (f(v))? _return(v) : _failure; });
  };

  // Try the parsers in the order passed and return undefined if no match
  var _choice = function() {
    var parsers = Array.prototype.slice.apply(arguments);
    return function(input) {
      if (parsers.length > 0) {
        var v = parse(parsers[0], input);
        return (v !== undefined)? v : parse(_choice.apply(null, parsers.slice(1)), input);
      }
      return undefined;
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
  var _many =function(p) {
    return _choice(_many1(p), _return([]));
  };

  // Many1
  // JavaScript is not lazy, so the inner parser function is required
  var _many1 = function(p) {
    return function(input) {
      var mp = _do(p, _many(p)).doReturn(consArgs);
      return parse(mp, input);
    };
  };

  // try p until b matches
  var _manyTill = function(p, b) {
    var _mt = function(input) {
      return parse((parse(b, input))? _return([]) :
              _do(p, _mt).doReturn(consArgs),
          input);
    };
    return _mt;
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
  var _eol = _symbol("\n");

  // EOF or end of input parser
  var _eof = function(input) {
    if (input === undefined || input === "") return _return("");
    return undefined;
  }

  // -- CSV parser ----------------------------------------------------------

  // Single value parser
  var _csv_value = _do(_manyTill(_item, _choice(_char(','), _eol, _eof))).doReturn(function (r) { return r.join(""); });

  // Same as for many many1 inplementation, we have to 
  // wrap the parser into a function
  var _csv_values = function(input) {
    var vp = _do(_csv_value, _csv_next_value).doReturn(consArgs);
    return parse(vp, input);
  };

  // Parse next value
  var _csv_next_value = _choice(
        _do(_char(","), _csv_values).doReturn(function(_,vs) { return vs; }), 
        _return([]));

  // Parse lines
  var _csv_lines = function(input) {
    var vp = _do(_csv_values, _csv_next_line).doReturn(consArgs);
    return parse(vp, input);
  };

  // Next line or eol
  var _csv_next_line = _choice(
        _do(_eol, _csv_lines).doReturn(function(_,ls) { return ls; }), 
        _return([]));

  // and the csv parser
  var _csv = _csv_lines;

  // -- Parser executor functions -------------------------------------------
  var parse = function (parser, input) {
    return parser(input);
  };

  // -- The Parser object exports public functions --------------------------
 
  var p = { };

  p._return     = _return;
  p._failure    = _failure;

  p._do         = _do;

  p._item       = _item;
  p._digit      = _sat(isDigit);
  p._alpha      = _sat(isAlpha);
  p._alphanum   = _sat(isAlphaNum);
  p._lower      = _sat(isLower);
  p._upper      = _sat(isUpper);

  p._choice     = _choice;
  p._char       = _char
  p._string     = _string
  p._many       = _many;
  p._many1      = _many1;

  p._space      = _space;
  p._token      = _token;
  p._seq        = _seq;
  p._symbol     = _symbol;
  p._eol        = _eol;

  p._manyTill   = _manyTill;

  // Parser executor
  p.parse       = parse;

  // Concrete parsers
  p._csv        = _csv;

  return p;

}();

