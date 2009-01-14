// --------------------------------------------------------------------------
// Tiny Math Processor (TinyMP) - a P4JS demo.
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

var TinyMP = function(p) {

  // Used parser combinators
  var _do       = p._do,
      _return   = p._return,
      _many1    = p._many1,
      _choice   = p._choice,
      _token    = p._token,
      _digit    = p._digit,
      _symbol   = p._symbol,
      _lower    = p._lower,
      joinArray = p.joinArray;

  // -- Arithmetic elements -------------------------------------------------

  // Every arithmetic element is an object that provides following functions:
  // eval()  - evaluate the element
  // print() - pretty print the element

  var constant = function(c) { 
    return { 
      eval  : _return(c),
      print : _return(c)
    };
  };

  var brackets  = function(a) { 
    return { 
      eval  : _do(a.eval).doReturn(function(x) { return x; }),
      print : _do(a.eval).doReturn(function(x) { return "(" + x + ")"; })
    };
  };

  var variable = function(x) { 
    return { 
      eval  : function(vars) { 
                var v = vars[x];
                if (v !== undefined) {
                  return _return(v)(vars);
                } else {
                  throw "Variable '" + x + "' not defined!";
                }
              },
      print : _return(x)
    };
  };

  var add = function(a, b) { 
    return { 
      eval  : _do(a.eval, b.eval).doReturn(function(x, y) { return x + y; }),
      print : _do(a.print, b.print).doReturn(function(x, y) { return x + " + " + y; })
    };
  };

  var minus = function(a, b) { 
    return { 
      eval  : _do(a.eval, b.eval).doReturn(function(x, y) { return x - y; }),
      print : _do(a.print, b.print).doReturn(function(x, y) { return x + " - " + y; })
    };
  };

  var mult = function(a, b) { 
    return { 
      eval  : _do(a.eval, b.eval).doReturn(function(x, y) { return x * y; }),
      print : _do(a.print, b.print).doReturn(function(x, y) { return x + " * " + y; })
    };
  };

  var div = function(a, b) { 
    return { 
      eval  : _do(a.eval, b.eval).doReturn(function(x, y) { return x / y; }),
      print : _do(a.print, b.print).doReturn(function(x, y) { return x + " / " + y; })
    };
  };

  var power = function(a, b) { 
    return { 
      eval  : _do(a.eval, b.eval).doReturn(function(x, y) { return Math.pow(x, y); }),
      print : _do(a.print, b.print).doReturn(function(x, y) { return x + "^" + y; })
    };
  };

  var sqrt = function(a) { 
    return { 
      eval  : _do(a.eval).doReturn(function(x) { return Math.sqrt(x); }),
      print : _do(a.print).doReturn(function(x) { return "~" + x; })
    };
  };

  var neg = function(a) { 
    return { 
      eval  : _do(a.eval).doReturn(function(x) { return 0.0 - x; }),
      print : _do(a.eval).doReturn(function(x) { return "-" + x; })
    };
  };

  // -- Expression parser ---------------------------------------------------

  // Natural number
  var _nat = _do(_token(_many1(_digit))).doReturn(joinArray("", parseInt));

  // Helper function to parse float numbers
  var div10 = function(n, f) {
    var fn = Math.pow(10, f);
    return (n > fn)? div10(n, f+1) : n / fn;
  };

   // Number parser
  var _num = _do(_nat).doResult(
    function(i) {
      return _choice(
        _do(_symbol("."), _nat).doReturn(function(_, f) { return constant(i + div10(f, 0)); }),
        _return(constant(i)));
    });

  // <Factor> ::= <Num> | ( <Exp> ) | - <Factor>
  var _factor = function(s) {
    return _choice(
      _do(_symbol("("), _exp, _symbol(")")).doReturn(function(_, f, __) { return brackets(f); }),
      _do(_symbol("-"), _factor).doReturn(function(_, f) { return neg(f); }),
      _do(_symbol("~"), _exp).doReturn(function(_, f) { return sqrt(f); } ),
      _do(_lower).doReturn(function(v) { return variable(v); }),
      _num)(s);
  };

  // <Expo> ::=  <Factor> * <Expo> | <Factor> / <Expo> | <Factor>
  var _expo = _do(_factor).doResult(
    function(f) {
      return _choice(
        _do(_symbol("^"), _expo).doReturn(function(_, t) { return power(f, t); } ),
        _return(f));
    });
  
  // <Term> ::=  <Expo> * <Term> | <Expo> / <Term> | <Expo>
  var _term = _do(_expo).doResult(
    function(e) {
      return _choice(
        _do(_symbol("*"), _term).doReturn(function(_, t) { return mult(e, t); } ),
        _do(_symbol("/"), _term).doReturn(function(_, t) { return div(e, t); } ),
        _return(e));
    });

  // <Exp> ::= <Term> + <Exp> | <Term> - <Exp> | <Term>
  var _exp = _do(_term).doResult(
    function(t) {
      return _choice(
        _do(_symbol("+"), _exp).doReturn(function(_, e) { return add(t, e); } ),
        _do(_symbol("-"), _exp).doReturn(function(_, e) { return minus(t, e); } ),
        _return(t));
    });

  // -- The processor object ------------------------------------------------

  var tmp = { };

  // Parse input into expression
  tmp.parse = function(input) {
                return p.parse(_exp, input);
              };

  // Evaluate an expression
  tmp.eval  = function(exp, vars) {
                return exp.eval(vars).value;
              };

  // Print an expression
  tmp.print = function(exp) {
                return exp.print().value;
              };

  // Pretty print error
  tmp.errorToString = p.errorToString;

  return tmp;

}(P4JS);

