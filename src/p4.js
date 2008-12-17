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
// 
// --------------------------------------------------------------------------

var P4JS = function() {

  // -- Some utility function -----------------------------------------------
 
  var isDigit    = function(c) { return ((c >= "0") && (c <= "9")); };
  var isLower    = function(c) { return ((c >= "a") && (c <= "z")); };
  var isUpper    = function(c) { return ((c >= "A") && (c <= "Z")); };
  var isAlpha    = function(c) { return isLower(c) || isUpper(c); };
  var isAlphaNum = function(c) { return isAlpha(c) || isDigit(c); };
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

  // Recursive bind used by the _do combinator.
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
    var slice = Array.prototype.slice,
        prs   = slice.apply(arguments),
        ret   = prs.pop();
    return _rec_bind(prs, ret, []);
  };

  // Helper function for _do is be the only argument
  // passed to the _do combinator. Function f processes
  // the results of all combinators defied in do, for example:
  // _do(_item, _item, doReturn(function(a,b) { return a + b; }))
  var doReturn = function (f) {
      return function() { 
          return pret(f.apply(null, arguments)); 
      };
  };

  // Helper function for _do that causes _do to fail, used mostly
  // for testing
  var doFail = function() {
      return function() { return _failure; };
  };

  // -- Basic parser combinators --------------------------------------------

  // Consume one char from input.
  var _item = function (input) {
    return (input === undefined)? undefined : 
      mkResult(input[0], input.slice(1));
  };

  // Parses next item if it satisfies f, otherwise fails.
  var _sat = function(f) {
    return _do(_item, 
        function(v) { return (f(v))? _return(v) : _failure; });
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
  var _string = function(v) {
    if (v.length > 0) {
        var c  = v.charAt(0),
            cs = v.substring(1);
        return _do(_char(c), _string(cs), doReturn(function(a, b) { return a + b; }));
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
  // _do(p, _return(""), doReturn(function(a, b) { return a.concat(b); }));
  var _many1 = function(p) {
    return function(input) {
      var v = parse(p, input);
      return (v === undefined)? undefined : 
        parse(_do(_many(p), doReturn(function(a) { return v.value + a; })), v.input);
    };
  };

  // -- Parser executor functions -------------------------------------------

  var parse = function (parser, input) {
    return parser(input);
  };

  // -- Parser object exporting public functions ----------------------------
 
  var p = { }

  p._return   = _return;
  p._failure  = _failure;

  p._do       = _do;
  p.doReturn  = doReturn;
  p.doFail    = doFail;

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

  p.parse = parse;

  return p;

}();

