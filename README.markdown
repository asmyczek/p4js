A generic parser library for JavaScript
========================

## Quick Introduction

A p4js parser is an object that provides basic combinators (parsing functions).
Function $P() creates a new parser object that can be executed on an input using 
parse(input) function. Most basic parsing function is $P().item(). It reads one char 
from the input and pushes it to the result array, for example 
$P().item().parse(’abc’) will return [’a']. 
If you expect to read a number char, use $P().digit(). This combinator reads 
the char only if it is a number, otherwise it throws a parser exception.

Every combinator returns same parser object which enables chaining 
of combinators. For example the following parser

<pre><code>
	var p = $P().item().item().item();
</code></pre>

returns the array [’a', ‘b’, ‘c’] for input p.parse(’abc’).
This result array can be reduced into one value using _do() and _reduce() combinators as following

<pre><code>
	var p = $P().do_().item().item().item().reduce(
		function(result_array) { return result_array.join(''); }
	);
</code></pre>

p.parse(’abc’) returns [’abc’].
Input function passed to reduce() is called only with results parsed between do_() and reduce()
and the result is pushed back to the array as one value. Every do_() action requires a matching reduce(),
or one of its customization, element(), join() etc.

Combinators many() and choice() provide more powerful parsing functionality. For example 

<pre><code>
	$P().many($P().digit()).parse(’123abc’) 
</code></pre>

parsers enier number from an input. Combine it with the following reduce() function, and we get 
a parser for natural numbers:

<pre><code>
	var p = $P().do_().many1($P().digit()).reduce(
		function(r) { return parseInt(r.join('')); }
	);
</code></pre>

This parser can be quite useful already, so we can register it with the default library calling 
p.register(’nat’) and use it from now on as $P().nat().

choice(p1, p2, …) tries to apply parsers pn in the argument order and returns the first 
successful parsed value or throws an exception if non of the parsers succeeded. 
The following example uses choice() to parse a number with optional decimal points:

<pre><code>
	var p = $P().do_().nat().choice(
		$P().symbol(".").nat().reduce(
			function(r) { while(r[2] > 1.0) r[2] /= 10; return r[0] + r[2]; }),
		$P().element(0)).register('num');
</code></pre>

For more details see the source code, examples or unit tests.

