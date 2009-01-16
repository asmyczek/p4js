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
      _many     = p._many,
      _many1    = p._many1,
      _choice   = p._choice,
      _token    = p._token,
      _digit    = p._digit,
      _symbol   = p._symbol,
      _lower    = p._lower,
      _eol      = p._eol,
      joinArray = p.joinArray;

  // -- Arithmetic elements -------------------------------------------------

  // Every arithmetic element is an object that provides following functions:
  // eval()  - evaluate the element
  // diff()  - differentiate expression
  // print() - pretty print the element

  var constant = function(c) { 
    return { 
      eval  : _return(c),
      diff  : function(s) { return _return(constant(0))(s); }, // Recursion again
      print : _return(c)
    };
  };

  var brackets  = function(a) { 
    return { 
      eval  : _do(a.eval).doReturn(function(x) { return x; }),
      diff  : _do(a.diff).doReturn(function(x) { return brackets(x); }),
      print : _do(a.print).doReturn(function(x) { return "(" + x + ")"; })
    };
  };

  var variable = function(x) { 
    return { 
      eval  : function(vars) { 
                var v = vars[x];
                if (v !== undefined) {
                  return _return(v.eval(vars).value)(vars);
                } else {
                  throw "Variable '" + x + "' not defined!";
                }
              },
      diff  : function(diff_var) {
                return (diff_var === x)? _return(constant(1))(diff_var) : _return(constant(0));
              },
      print : function(vars) {
                var v = vars[x];
                // v exists, print the referenced value
                // otherwise print the variable name
                return ((v !== undefined)? _return(v.print(vars).value) : _return(x))(vars);
              }
    };
  };

  var add = function(a, b) { 
    return { 
      eval  : _do(a.eval, b.eval).doReturn(function(x, y) { return x + y; }),
      diff  : _do(a.diff, b.diff).doReturn(function(x, y) { return add(x, y); }),
      print : _do(a.print, b.print).doReturn(function(x, y) { return x + " + " + y; })
    };
  };

  var minus = function(a, b) { 
    return { 
      eval  : _do(a.eval, b.eval).doReturn(function(x, y) { return x - y; }),
      diff  : _do(a.diff, b.diff).doReturn(function(x, y) { return minus(x, y); }),
      print : _do(a.print, b.print).doReturn(function(x, y) { return x + " - " + y; })
    };
  };

  var mult = function(a, b) { 
    return { 
      eval  : _do(a.eval, b.eval).doReturn(function(x, y) { return x * y; }),
      diff  : _do(a.diff, b.diff).doReturn(function(x, y) { return add(mult(x, b), mult(a, y)); }),
      print : _do(a.print, b.print).doReturn(function(x, y) { return x + " * " + y; })
    };
  };

  var div = function(a, b) { 
    return { 
      eval  : _do(a.eval, b.eval).doReturn(function(x, y) { return x / y; }),
      diff  : _do(a.diff, b.diff).doReturn(function(x, y) { return div(minus(mult(x, b), mult(a, y)), brackets(power(b, 2))); }),
      print : _do(a.print, b.print).doReturn(function(x, y) { return x + " / " + y; })
    };
  };

  var power = function(a, b) { 
    return { 
      eval  : _do(a.eval, b.eval).doReturn(function(x, y) { return Math.pow(x, y); }),
      diff  : function(s) { return _return(mult(b, power(a, brackets(minus(constant(1), b)))))(s) },
      print : _do(a.print, b.print).doReturn(function(x, y) { return x + "^" + y; })
    };
  };

  var sqrt = function(a) { 
    return { 
      eval  : _do(a.eval).doReturn(function(x) { return Math.sqrt(x); }),
      diff  : function(s) { return _return(mult(constant(0.5), power(a, brackets(neg(constant(0.5))))))(s); },
      print : _do(a.print).doReturn(function(x) { return "~" + x; })
    };
  };

  var neg = function(a) { 
    return { 
      eval  : _do(a.eval).doReturn(function(x) { return 0.0 - x; }),
      diff  : _do(a.diff).doReturn(function(x) { return neg(x); }),
      print : _do(a.eval).doReturn(function(x) { return "-" + x; })
    };
  };

  var assig = function(a, b, vars) {
    var v = a.print(vars).value;
    if (v.length === 1) {
      vars[v] = b;
    } else {
      throw "Left side of an assigment is not a variable!";
    }
    return {
      eval  : function() { throw "Cannot evaluate an assignment!"; },
      diff  : function() { throw "Cannot diff on an assignment!"; },
      print : _do(a.print, b.print).doReturn(function(x, y) { return x + "=" + y; })
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

  // _eval parser
  var _do_eval = function(s) { 
    return _do(_symbol("eval("), _exp, _symbol(")")).doReturn(function(_, f, __) { eval_exp(f, s.data.vars, s.data.ul); return _return(); })(s);
  };

  // _eval parser
  var _do_print = function(s) { 
    return _do(_symbol("print("), _exp, _symbol(")")).doReturn(function(_, f, __) { print_exp(f, s.data.vars, s.data.ul); return _return(); })(s);
  };

  // <Factor> ::= <Num> | ( <Exp> ) | - <Factor>
  var _factor = function(s) {
    return _choice(
      _do(_symbol("("), _exp, _symbol(")")).doReturn(function(_, f, __) { return brackets(f); }),
      _do(_symbol("-"), _factor).doReturn(function(_, f) { return neg(f); }),
      _do(_symbol("~"), _exp).doReturn(function(_, f) { return sqrt(f); } ),
      _do_eval,
      _do_print,
      _do(_lower).doReturn(function(v) { return variable(v); }),
      _num
      )(s);
  };

  // Parse assigment
  var _do_assig = function(f) {
    return function(s) { 
      return _do(_symbol("="), _exp).doReturn(function(_, e) { return assig(f, e, s.data.vars) })(s); 
    };
  };

  // <Expo> ::=  <Factor> * <Expo> | <Factor> / <Expo> | <Factor>'<DiffVar> | <Factor>
  var _expo = _do(_factor).doResult(
    function(f) {
      return _choice(
        _do(_symbol("^"), _exp).doReturn(function(_, t) { return power(f, t); } ),
        _do(_symbol("'"), _token(_lower)).doReturn(function(_, v) { return diff(f, v) }),
        _do_assig(f),
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

  var _exp_line = _do(_exp, _eol).doReturn(function(e, _) { return e; });
  var _mathp    = _many(_exp_line);

  // -- Processor functions -------------------------------------------------

  // Differentiate on diff_var
  var diff      = function(exp, diff_var) {
                    return exp.diff(diff_var).value;
                  };

  // Evaluate expression
  var eval_exp  = function(exp, vars, ul) {
                    print(exp.eval(vars).value, ul);
                  };

  // Print an expression
  var print_exp = function(exp, vars, ul) {
                    print(exp.print(vars).value, ul);
                  };

  // Print to output
  var print = function(v, ul) {
                var li = document.createElement('li');
                li.innerHTML = v;
                ul.appendChild(li);
              };

  // Clean output list and canvas
  var clean = function(ul, canvas) {
                while (ul.firstChild) ul.removeChild(ul.firstChild);
                // TODO: clean canvas
              };

  // -- The processor object ------------------------------------------------

  return function(ul_element, canvas_element) {

    var tmp = { };

    // Parse input into expression
    tmp.parse = function(input) {
                  clean(ul_element, canvas_element);
                  var data = { vars   : [],
                               ul     : ul_element,
                               canvas : canvas_element };
                  return p.parse(_mathp, input, data);
                };

    // Pretty print error
    tmp.errorToString = p.errorToString;

    return tmp;
  };

}(P4JS);

