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

  // Graph color map
  var color_map = [ "rgb(180, 0  , 0)"
                  , "rgb(0  , 180, 0)"
                  , "rgb(0  , 0  , 180)"
                  , "rgb(180, 180, 0)"
                  , "rgb(0  , 180, 180)"
                  , "rgb(180, 0  , 180)"
                  , "rgb(180, 180, 180)" ];

  // Rage of the graph display
  // from -(graph_x_range/2) to (graph_x_range/2)
  var graph_x_range = 12;

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
      diff  : function(s, vars) { return _return(constant(0))(s, vars); }, // Recursion again
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
                  throw { type: "Evaluation error", message : "Variable '" + x + "' not defined!" };
                }
              },
      diff  : function(diff_var, vars) {
                var v = vars[x];
                if (v !== undefined) {
                  return _return(diff_exp(v, diff_var, vars))(diff_var, vars);
                } else {
                  return (diff_var === x)? _return(constant(1))(diff_var, vars) : _return(constant(0))(diff_var, vars);
                }
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
      diff  : function(s, vars) { return _return(mult(b, power(a, brackets(minus(constant(1), b)))))(s, vars) },
      print : _do(a.print, b.print).doReturn(function(x, y) { return x + "^" + y; })
    };
  };

  var sqrt = function(a) { 
    return { 
      eval  : _do(a.eval).doReturn(function(x) { return Math.sqrt(x); }),
      diff  : function(s, vars) { return _return(mult(constant(0.5), power(a, brackets(neg(constant(0.5))))))(s, vars); },
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
      throw { type: "Evaluation error", message : "Left side of an assigment is not a variable!" };
    }
    return {
      eval  : function() { 
                throw { type: "Evaluation error", message : "Cannot evaluate an assignment!" };
              },
      diff  : function() { 
                throw { type: "Evaluation error", message : "Cannot diff on an assignment!" };
              },
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

  // _eval parser
  var _do_draw = function(s) { 
    return _do(_symbol("draw("), 
               _exp, 
               _symbol(","), 
               _token(_lower),
               _symbol(")")).doReturn(
             function(_a, f, _b, v, _c) { 
               draw_exp(f, v, s.data.vars, s.data); 
               return _return(); 
             })(s);
  };

  // <Factor> ::= <Num> | ( <Exp> ) | - <Factor>
  var _factor = function(s) {
    return _choice(
      _do(_symbol("("), _exp, _symbol(")")).doReturn(function(_, f, __) { return brackets(f); }),
      _do(_symbol("-"), _factor).doReturn(function(_, f) { return neg(f); }),
      _do(_symbol("~"), _exp).doReturn(function(_, f) { return sqrt(f); } ),
      _do_eval,
      _do_print,
      _do_draw,
      _do(_token(_lower)).doReturn(function(v) { return variable(v); }),
      _num
      )(s);
  };

  // Parse assigment
  var _do_assig = function(f) {
    return function(s) { 
      return _do(_symbol("="), _exp).doReturn(function(_, e) { return assig(f, e, s.data.vars); })(s); 
    };
  };

  // Parse derivation
  var _do_diff = function(f) {
    return function(s) { 
      return _do(_symbol("'"), _token(_lower)).doReturn(function(_, v) { return diff_exp(f, v, s.data.vars); })(s);
    };
  };

  // <Expo> ::=  <Factor> * <Expo> | <Factor> / <Expo> | <Factor>'<DiffVar> | <Factor>
  var _expo = _do(_factor).doResult(
    function(f) {
      return _choice(
        _do(_symbol("^"), _exp).doReturn(function(_, t) { return power(f, t); } ),
        _do_diff(f),
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
  var diff_exp  = function(exp, diff_var, vars) {
                    return exp.diff(diff_var, vars).value;
                  };

  // Evaluate expression
  var eval_exp  = function(exp, vars, ul) {
                    print(exp.eval(vars).value, ul);
                  };

  // Print an expression
  var print_exp = function(exp, vars, ul) {
                    print(exp.print(vars).value, ul);
                  };

  // Draw a function graph
  var draw_exp  = function(exp, x_var, vars, data) {
                    if (data.canvas.getContext) {
                      var ctx        = data.canvas.getContext("2d"),
                          width      = data.canvas.width,
                          height     = data.canvas.height,
                          graphCount = data['graphCount'],
                          rangeDiff  = graph_x_range / width,
                          mvars      = [];

                      // Copy vars
                      var v;
                      for (v in vars) mvars[v] = vars[v];

                      // Some helpers
                      px2value = function(px) {
                        return -(graph_x_range/2) + (px * rangeDiff);
                      };

                      value2px = function(value) {
                        return height/2 - (value / rangeDiff);
                      };

                      // Draw
                      ctx.strokeStyle = color_map[graphCount % color_map.length];
                      ctx.lineWidth = 1;
                      ctx.beginPath();

                      // Draw the rest
                      var drawing = false;
                      var px;
                      for (px = 0; px < width; px++) {
                        mvars[x_var] = constant(px2value(px));
                        y = exp.eval(mvars).value;
                        if ((y !== Infinity) && (y !== Infinity)) {
                          if (drawing) {
                            ctx.lineTo(px, value2px(y));
                          } else {
                            ctx.moveTo(px, value2px(y));
                            drawing = true;
                          }
                        } else {
                          drawing = false;
                        }
                      }
                      ctx.stroke();

                      data['graphCount'] = graphCount + 1;
                    }
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
                if (canvas.getContext) {
                  var ctx = canvas.getContext("2d");
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  // draw coordinates
                  // draw axis
                  var center = { x : canvas.width / 2, 
                                 y : canvas.height / 2 }
                  // draw axis
                  ctx.strokeStyle = "rgb(0,0,0)"
                  ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.moveTo(0, center.y);
                  ctx.lineTo(canvas.width, center.y);
                  ctx.moveTo(center.x, 0);
                  ctx.lineTo(center.x, canvas.height);
                  ctx.stroke();

                  var vdiff = canvas.width / graph_x_range;
                  var i;
                  for (i = 1; i < 7; i++) {
                    ctx.beginPath();
                    ctx.moveTo(center.x + i * vdiff, center.y);
                    ctx.lineTo(center.x + i * vdiff, center.y + (graph_x_range/2));
                    ctx.moveTo(center.x - i * vdiff, center.y);
                    ctx.lineTo(center.x - i * vdiff, center.y + (graph_x_range/2));
                    ctx.moveTo(center.x, center.y + i * vdiff);
                    ctx.lineTo(center.x + (graph_x_range/2), center.y + i * vdiff);
                    ctx.moveTo(center.x, center.y - i * vdiff);
                    ctx.lineTo(center.x + (graph_x_range/2), center.y - i * vdiff);
                    ctx.stroke();
                  }
                }
              };

  // -- The processor object ------------------------------------------------

  return function(ul_element, canvas_element) {

    var tmp = { };

    // Parse input into expression
    tmp.parse = function(input) {
                  clean(ul_element, canvas_element);
                  var data = { vars       : [],
                               ul         : ul_element,
                               canvas     : canvas_element,
                               graphCount : 0 };
                  return p.parse(_mathp, input, data);
                };

    // Pretty print error
    tmp.errorToString = p.errorToString;

    return tmp;
  };

}(P4JS);

