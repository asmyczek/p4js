A generic parser library for JavaScript
========================

## Quick Introduction

A parser in p4js is an object that provides the basic combinators (parsing functions).
The function $P() creates a parser object that can be executed on an input using the 
parse(input) function. The most basic combinator is $P().item(). It reads one char 
from the input and pushes it to the result array, for example 
$P().item().parse(’abc’) will return the array [’a']. 
If you expect to read a number char, use $P().digit(). This combinator will read 
the char only if it is a number, otherwise it will throw a parser exception.

Every combinator returns the parser object itself. This enables the chaining 
of combinators to build more complex parsers. For example the parser

<pre><code>
	var p = $P().item().item().item();
</code></pre>

will return the array [’a', ‘b’, ‘c’] for p.parse(’abs’).
To combine the results of multiple combinators into one value,
chain those between the do_() and reduce() actions, for example:

<pre><code>
	var p = $P().do_().item().item().item().reduce(
		function(result_array) { return result_array.join(''); }
	);
</code></pre>

p.parse(’abc’) will return [’abc’].
The function passed to reduce() is called only with the results of the combinators
executed between do_() and reduce(). The result of this function is pushed as one value
to the result array. In the parser chain, every do_() action requires a matching reduce(),
or one of its customization: element(), join() etc.

It gets more exciting with the combinators many() and choice(). many(p) or many1(p) 
applies parser p on the input as many times as possible. For example 

<pre><code>
	$P().many($P().digit()).parse(’123abc’) 
</code></pre>

will return [’1′, ‘2′, ‘3′]. 
Combining this with a reduce function that converts the result into an integer, 
we get a parser for natural numbers:

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

First we use nat() to read the integer part of the number. Than we try to read a ‘.’ 
followed by an nat() for the decimal part. In case this succeeds we compute the decimal 
number and return the result. Otherwise we use $P().element(0) to return the first element
of the first nat() call, the integer part.

For more details see the source code, examples or unit tests.

