# Literals

Dataview query language *literals* are expressions which represent constant values like `"hello"` or `1337`.

The following is an extensive, but non-exhaustive list of possible literals in DQL.

|Literal|Description|
|-|-|
|`0`|The number zero|
|`1337`|A positive number|
|`-1337`|A negative number|
|`"The quick brown fox jumps over the lazy dog"`|Some text, commonly referred to by programmers as a *string*|
|`date(2021-11-11)`|A date, November 11th, 2021. Note: that `date()` is also a function.|
|`dur(1 s)`|A duration; one second|
|`dur(3 s)`|A duration; three seconds|
|`dur(1 sec)`|A duration; one second|
|`dur(3 secs)`|A duration; three seconds|
|`dur(1 second)`|A duration; one second|
|`dur(3 seconds)`|A duration; three seconds|
|`dur(1 m)`|A duration; one minute|
|`dur(3 m)`|A duration; three minutes|
|`dur(1 min)`|A duration; one minute|
|`dur(3 mins)`|A duration; three minutes|
|`dur(1 minute)`|A duration; one minute|
|`dur(3 minutes)`|A duration; three minutes|
|`dur(1 h)`|A duration; one hour|
|`dur(3 h)`|A duration; three hours|
|`dur(1 hour)`|A duration; one hour|
|`dur(3 hours)`|A duration; three hours|
|`dur(1 d)`|A duration; one day|
|`dur(3 d)`|A duration; three days|
|`dur(1 day)`|A duration; one day|
|`dur(3 days)`|A duration; three days|
|`dur(1 w)`|A duration; one day|
|`dur(3 w)`|A duration; three days|
|`dur(1 week)`|A duration; one day|
|`dur(3 weeks)`|A duration; three days|
|`dur(1 mo)`|A duration; one month|
|`dur(3 mo)`|A duration; three months
|`dur(1 month)`|A duration; one month|
|`dur(3 months)`|A duration; three months|
|`dur(1 year)`|A duration; one year|
|`dur(3 years)`|A duration; three years|
|`dur(1 s, 2 m, 3 h)`|A duration; three hours, 2 minutes, and 1 second|
|`dur(1 s 2 m 3 h)`|A duration; three hours, 2 minutes, and 1 second|
|`dur(1s 2m 3h)`|A duration; three hours, 2 minutes, and 1 second|
|`dur(1second 2min 3h)`|A duration; three hours, 2 minutes, and 1 second|
|`[[Link]]`|A link to the file named "Link"|
|`[1, 2, 3]`|A list of numbers 1, 2, and 3|
|`[[1, 2],[3, 4]]`|A list of lists|
|`{ a: 1, b: 2 }`|An object| 
