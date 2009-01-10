// --------------------------------------------------------------------------
// Monadic parser library for JavaScript
// inspired by Graham Hutton's "Programming in Haskell - Functional Parsers"
// See README for details.
//
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

  // Helper for array join results
  var joinArray = function(joinChar, f) {
    return function(as) {
      var c = joinChar || "",
          r = as.join(c);
      return (f === undefined)? r : f(r);
    };
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

  // Create Parser
  var mkParser = function(value, state) {
    return { value : value,
             state : state };
  };

  // Create parse state
  var mkState = function(input, line, column) {
    return { input  : input, 
             line   : line || 1, 
             column : column || 0 };
  };

  // Create error object
  var mkError = function(message, state) {
    return { message : message,
             line    : state.line,
             column  : state.column,
             input   : state.input };
  };

  // Pretty print error message
  var errorToString = function(e) {
    var msg    = e.message || e,
        line   = e.line || "?",
        column = e.column || "?";
    return "Error: " + msg + " at (" + line + ", " + column + ")";
  };

  // -- Monadic operators ---------------------------------------------------
 
  // return
  var _return = function(value) {
    return function (state) { return mkParser(value, state); };
  };

  // failure
  var _failure = function(error_msg) {
    return function (state) { throw mkError(error_msg, state); };
  };

  // bind
  var _bind = function(p, f) {
    return function(state) {
      var v = p(state);
      return f(v.value)(v.state);
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
        doReturn : function(f)         { return bind_parser(function() { return _return(f.apply(null, arguments)); }); },
        doResult : function(f)         { return bind_parser(f); },
        doFail   : function(error_msg) { return _failure(error_msg); }
    };
  };

  // -- Basic parser combinators --------------------------------------------

  // Consume one char from input.
  var _item = function (state) {
    if (state === undefined || state.input === "") {
      throw mkError("Invalid input: " + state.input, state);
    } else {
      var v  = state.input[0],
          vs = state.input.slice(1),
          st = (isEqual(v, "\n"))? mkState(vs, state.line + 1, 0) :
                                   mkState(vs, state.line, state.column + 1);
        return mkParser(v, st);
    }
  };

  // Parses next item if it satisfies f, otherwise fails.
  var _sat = function(f, error_msg) {
    return _do(_item).doResult(function(v) { return (f(v))? _return(v) : _failure(error_msg); });
  };

  // Try the parsers in the order passed and return undefined if no match
  var _choice = function() {
    var parsers = Array.prototype.slice.apply(arguments);
    return function(state) {
      if (parsers.length > 0) {
        try {
          return parsers[0](state);
        } catch(e) {
          return _choice.apply(null, parsers.slice(1))(state);
        }
      }
      throw mkError("No match for _choice!", state);
    };
  };

  // Parses next input if it satisfies v, otherwise fails.
  var _char = function(c) {
    return _sat(curry(isEqual)(c), "Not a '" + c + "'!");
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
    return function(state) {
      return _do(p, _many(p)).doReturn(cons)(state);
    };
  };

  // try p until b matches
  // TODO: try without try-catch
  var _manyTill = function(p, b) {
    var _mt = function(state) {
      try {
        b(state);
        return _return([])(state);
      } catch (e) {
        return _do(p, _mt).doReturn(cons)(state);
      }
    };
    return _mt;
  };

  // A char in match
  var _oneOf = function(match) {
    return _sat(function(c) { return match.indexOf(c) != -1; }, "Not OneOf '" + match + "'!");
  };

  // Not a char in match
  var _noneOf = function(match) {
    return _sat(function(c) { return match.indexOf(c) == -1; }, "Not NoneOf '" + match + "'!");
  };

  // -- Tokenizer -----------------------------------------------------------

  // Truncates leading spaces from a input
  var _space = _do(_many(_sat(isSpace))).doReturn(function(a) { return ""; }, "Not a Space!");

  // Ignore spacing around to parsed input
  var _token = function(p) {
    return _do(_space, p, _space).doReturn(function(a,b,c) { return b; });
  };

  // Parse next char sequence
  var _seq = _do(_token(_many(_sat(isAlphaNum, "Not an AlphaNum!")))).doReturn(joinArray());

  // Parse next symbol str
  var _symbol = function(str) {
    return _token(_string(str));
  };

  // Parse new line
  var _eol = _symbol("\n");

  // EOF or end of input parser
  var _eof = function(state) {
    if (state === undefined || state.input === "") return _return("");
    throw mkError("Not EOF!", state);
  }

  // -- The Parser object exports public functions --------------------------
 
  var p = { };

  p._return     = _return;
  p._failure    = _failure;

  p._do         = _do;

  p._item       = _item;
  p._digit      = _sat(isDigit,     "Not a Digit!");
  p._alpha      = _sat(isAlpha,     "Not an Alpha char!");
  p._alphanum   = _sat(isAlphaNum,  "Not an AlphaNum char!");
  p._lower      = _sat(isLower,     "Not a lower case char!");
  p._upper      = _sat(isUpper,     "Not a upper case char!");

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
  p._eof        = _eof;

  p._manyTill   = _manyTill;
  p._oneOf      = _oneOf;
  p._noneOf     = _noneOf;

  // Parser executor
  p.parse       = function(parser, input) {
                    return parser(mkState(input)).value;
                  };

  // Helpers
  p.cons            = cons;
  p.joinArray       = joinArray;
  p.errorToString   = errorToString;

  return p;

}();

