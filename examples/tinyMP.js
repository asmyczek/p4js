// An extendet P4JS demo
// ---------------------
var TinyMP = function() {

  // Graph color map
  var color_map = [ "rgb(180, 0  , 0)"
                  , "rgb(0  , 180, 0)"
                  , "rgb(0  , 0  , 180)"
                  , "rgb(180, 180, 0)"
                  , "rgb(0  , 180, 180)"
                  , "rgb(180, 0  , 180)"
                  , "rgb(180, 180, 180)" ];

  // Range of the graph display
  // from -(graph_x_range/2) to (graph_x_range/2)
  var graph_x_range = 12;

  // -- Arithmetic elements -------------------------------------------------

  // Every arithmetic element is an object that provides following functions:
  // left()  - left associate expression tree
  // eval()  - evaluate the element
  // diff()  - differentiate expression
  // print() - pretty print the element

  var constant = function(c) { 
    return { 
      left  : function() { return this; },
      eval  : $P().return_(c),
      diff  : $P().bind(function(vs) { this.runParser($P().return_(constant(0)), vs); }),
      print : $P().return_(c)
    };
  };

  var brackets  = function(a) { 
    return { 
      a     : a,
      op    : brackets,
      left  : function() { return a.left(); },
      eval  : $P().do_(a.eval).element(0),
      diff  : $P().do_(a.diff).element(0,function(x) { return brackets(x); }),
      print : $P().do_(a.print).element(0, function(x) { return "(" + x + ")"; })
    };
  };

  var variable = function(x) { 
    return { 
      a     : x,
      left  : function() { return this; },
      eval  : $P().bind(function(vs) {
                var v = this.input()[x];
                if (!v) {
                  throw error("Variable '" + x + "' not defined!", this);
                } else {
                  return this.runParser($P().return_(v.eval.parse(this.input())[0]), vs);
                }
              }),
      diff  : $P().bind(function(vs) {
                var v = this.input()[x];
                var r;
                if (v !== undefined) {
                   return this.runParser($P().return_(diff_exp(v, this.data(), this.input())), vs);
                } else {
                  if (this.data() === x) {
                    return this.runParser($P().return_(constant(1)), vs);
                  } else {
                    return this.runParser($P().return_(constant(0)), vs);
                  }
                }
                return r;
              }),
      print : $P().bind(function(vs) {
                  var v = this.input()[x];
                  // v exists, print the referenced value
                  // otherwise print the variable name
                  if (!v) {
                    this.runParser($P().return_(x), vs);
                  } else {
                    this.runParser($P().return_(v.print.parse(this.input())[0]), vs);
                  }
              })
    };
  };

  var unary = function(a, op) {
    return { a    : a,
             op   : op,
             left : function() { return associate_left(this.op, a); } };
  };

  var binary = function(a, b, op) {
    return { a    : a,
             b    : b,
             op   : op,
             left : function() { return associate_left(this.op, a, b); } };
  };

  var add = function(a, b) { 
    var r = binary(a, b, add);
    r.eval  = $P().do_(a.eval, b.eval).reduce(function(rv) { return rv[0] + rv[1]; });
    r.diff  = $P().do_(a.diff, b.diff).reduce(function(rv) { return add(rv[0], rv[1]); });
    r.print = $P().do_(a.print, b.print).reduce(function(rv) { return rv[0] + " + " + rv[1]; });
    return r;
  };

  var minus = function(a, b) { 
    var r = binary(a, b, minus);
    r.eval  = $P().do_(a.eval, b.eval).reduce(function(rv) { return rv[0] - rv[1]; });
    r.diff  = $P().do_(a.diff, b.diff).reduce(function(rv) { return minus(rv[0], rv[1]); });
    r.print = $P().do_(a.print, b.print).reduce(function(rv) { return rv[0] + " - " + rv[1]; });
    return r;
  };

  var mult = function(a, b) { 
    var r = binary(a, b, mult);
    r.eval  = $P().do_(a.eval, b.eval).reduce(function(rv) { return rv[0] * rv[1]; });
    r.diff  = $P().do_(a.diff, b.diff).reduce(function(rv) { return add(mult(rv[0], b), mult(a, rv[1])); });
    r.print = $P().do_(a.print, b.print).reduce(function(rv) { return rv[0] + " * " + rv[1]; });
    return r;
  };

  var div = function(a, b) { 
    var r = binary(a, b, div);
    r.eval  = $P().do_(a.eval, b.eval).reduce(function(rv) { return rv[0] / rv[1]; });
    r.diff  = $P().do_(a.diff, b.diff).reduce(function(rv) { return div(minus(mult(rv[0], b), mult(a, rv[1])), brackets(power(b, 2))); });
    r.print = $P().do_(a.print, b.print).reduce(function(rv) { return rv[0] + " / " + rv[1]; });
    return r;
  };

  var power = function(a, b) { 
    var r = binary(a, b, power);
    r.eval  = $P().do_(a.eval, b.eval).reduce(function(rv) { return Math.pow(rv[0], rv[1]); });
    r.diff  = $P().bind(function(vs) { return this.runParser($P().return_(mult(b, power(a, brackets(minus(b, constant(1)))))), vs); });
    r.print = $P().do_(a.print, b.print).reduce(function(rv) { return rv[0] + "^" + rv[1]; });
    return r;
  };

  var sqrt = function(a) { 
    var r = unary(a, sqrt);
    r.eval  = $P().do_(a.eval).element(0, function(x) { return Math.sqrt(x); });
    r.diff  = $P().bind(function(vs) { return this.runParser($P().return_(mult(constant(0.5), power(a, brackets(neg(constant(0.5)))))), vs); });
    r.print = $P().do_(a.print).element(0, function(x) { return "~" + x; });
    return r;
  };

  var neg = function(a) { 
    var r = unary(a, neg);
    r.eval  = $P().do_(a.eval).element(0, function(x) { return 0.0 - x; });
    r.diff  = $P().do_(a.diff).element(0, function(x) { return neg(x); });
    r.print = $P().do_(a.eval).element(0, function(x) { return "-" + x; });
    return r;
  };

  var assig = function(a, b, vars) {
    vars[a.a] = b;
    return {
      left  : function() { throw error("Cannot evaluate an assignment!"); },
      eval  : function() { throw error("Cannot evaluate an assignment!"); },
      diff  : function() { throw error("Cannot diff on an assignment!"); },
      print : $P().do_(a.print, b.print).reduce(function(rv) { return rv[0] + "=" + rv[1]; })
    };
  };

  // -- Expression parser ---------------------------------------------------

  // Natural number
  $P().token($P().do_().many1($P().digit()).int()).register('nat');

  // Number parser
  $P().do_().nat().choice(
      $P().symbol(".").nat().reduce(function(rv) { while(rv[2] > 1.0) rv[2] /= 10; return constant(rv[0] + rv[2]); }),
      $P().element(0, function(v) { return constant(v); })).register('num');
  
  // Factor
  P4JS.lib.factor = function() { 
    return this.bind(function(vs) { this.runParser(
      $P().choice(
        $P().do_().symbol("(").exp().symbol(")").element(1, function(v) { return brackets(v); }),
        $P().do_().symbol("-").factor().element(1, function(f) { return neg(f); }),
        $P().do_().symbol("~").exp().element(1, function(f) { return sqrt(f); } ),
        $P().do_().symbol("eval(").exp().symbol(")").element(1, function(f) { eval_exp(f, this.state.data.vars, this.state.data.ul); }),
        $P().do_().symbol("print(").exp().symbol(")").element(1, function(f) { print_exp(f, this.state.data.vars, this.state.data.ul); }),
        $P().do_().symbol("draw(").exp().symbol(",").token($P().lower()).symbol(")").reduce(
           function(vs) { draw_exp(vs[1], vs[3], this.state.data.vars, this.state.data); }),
        $P().do_().token($P().lower()).element(0, function(v) { return variable(v); }),
        $P().num()), vs);
    });
  };

  // Expo
  P4JS.lib.prim = function() { 
    return this.bind(function(vs) { this.runParser(
      $P().do_().factor().choice(
        $P().symbol("^").prim().reduce(function(rv) { return power(rv[0], rv[2]); } ),
        $P().symbol("'").token($P().lower()).reduce(function(rv) { return diff_exp(rv[0], rv[2], this.state.data.vars); }),
        $P().symbol("=").exp().reduce(function(rv) { return assig(rv[0], rv[2], this.state.data.vars); }),
        $P().element(0)), vs);
    });
  };
  
  // Term
  P4JS.lib.term = function() { 
    return this.bind(function(vs) { this.runParser(
      $P().do_().prim().choice(
        $P().symbol("*").term().reduce(function(rv) { return mult(rv[0], rv[2]); } ),
        $P().symbol("/").term().reduce(function(rv) { return div(rv[0], rv[2]); } ),
        $P().element(0)), vs);
    });
  };


  // Exp
  P4JS.lib.exp = function() { 
    return this.bind(function(vs) { this.runParser(
      $P().do_().term().choice(
          $P().symbol("+").exp().reduce(function(rv) { return add(rv[0], rv[2]); } ),
          $P().symbol("-").exp().reduce(function(rv) { return minus(rv[0], rv[2]); } ),
          $P().element(0)), vs);
      });
  };

  // The parser
  $P().do_().exp().eol().element(0).register('exp_line');
  $P().many($P().exp_line()).register('mathp');

  // -- Processor functions -------------------------------------------------

  var associate_left = function(operator, a, b) {
    if (b !== undefined) {
      return (b.b !== undefined)? associate_left(b.op, operator(a, b.a), b.b) : operator(a, b);
    }
    return (a.b !== undefined)? associate_left(a.op, operator(a.a), a.b) : operator(a);
  };

  // Differentiate on diff_var
  var diff_exp  = function(exp, diff_var, vars) {
                    return exp.diff.parse(vars, diff_var)[0];
                  };

  // Evaluate expression
  var eval_exp  = function(exp, vars, ul) {
                    print(exp.left().eval.parse(vars)[0], ul);
                  };

  // Print an expression
  var print_exp = function(exp, vars, ul) {
                    print(exp.print.parse(vars)[0], ul);
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
                        y = exp.left().eval.parse(mvars)[0];
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

  // Create error message
  var error = function(err, p) {
    var e = (p && p.error !== undefined)? p.error(err) : { print : function() { return err; } };
    e.type = "Evaluation error";
    return e;
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

                  // draw tic marks
                  var vdiff = canvas.width / graph_x_range;
                  var num_tics = graph_x_range / 2 + 1;
                  var tic_length = 6;
                  var i;
                  for (i = 1; i < num_tics; i++) {
                    ctx.beginPath();
                    ctx.moveTo(center.x + i * vdiff, center.y);
                    ctx.lineTo(center.x + i * vdiff, center.y + tic_length);
                    ctx.moveTo(center.x - i * vdiff, center.y);
                    ctx.lineTo(center.x - i * vdiff, center.y + tic_length);
                    ctx.moveTo(center.x, center.y + i * vdiff);
                    ctx.lineTo(center.x + tic_length, center.y + i * vdiff);
                    ctx.moveTo(center.x, center.y - i * vdiff);
                    ctx.lineTo(center.x + tic_length, center.y - i * vdiff);
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
                  return $P().mathp().eoi().parse(input, data);
                };

    return tmp;
  };

}();

