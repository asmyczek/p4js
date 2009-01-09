// --------------------------------------------------------------------------
// CSV parser for P4JS
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
var CSV = function(p) {

  // Parsers used for csv
  var _do       = p._do,
      _return   = p._return,
      _many     = p._many,
      _noneOf   = p._noneOf,
      _choice   = p._choice,
      _char     = p._char,
      _eol      = p._eol,
      _eof      = p._eof,
      cons      = p.cons,
      joinArray = p.joinArray;

  // Trim string helper
  var trim = function(str) {
    return str.replace(/^\s+|\s+$/g, '');
  };

  // Parse one cs-value
  var _value = _do(_many(_noneOf(",\n"))).doReturn(joinArray("", trim));

  // Parse values
  var _values = function(state) {
    return _do(_value, _next_value).doReturn(cons)(state);
  };

  // Parse next value
  var _next_value = _choice(
        _do(_char(","), _values).doReturn(function(_,vs) { return vs; }), 
        _return([]));

  // Parse multiple lines
  var _lines = function(state) {
    return _do(_values, _next_line).doReturn(cons)(state);
  };

  // Parse next line
  var _next_line = _choice(
        _do(_eol, _lines).doReturn(function(_,vs) { return vs; }), 
        _return([]));

  // The csv parser
  var _csv = _lines;


  // Return csv parser object
  var csv = { };
  csv.parse = function(input) {
                return p.parse(_csv, input);
              };
  csv.errorToString = p.errorToString;
  return csv;

}(P4JS);

