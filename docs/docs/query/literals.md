# Literals

Dataview query language *literals* are expressions which represent constant values like `"hello"` or `1337`.

The following is an extensive, but non-exhaustive list of possible literals in DQL.

### General
Literal|Description
-|-
`0`|The number zero
`1337`|A positive number
`-1337`|A negative number
`"The quick brown fox jumps over the lazy dog"`|Some text, commonly referred to by programmers as a *string*
`[[Link]]`|A link to the file named "Link"
`[1, 2, 3]`|A list of numbers 1, 2, and 3
`[[1, 2],[3, 4]]`|A list of lists
`{ a: 1, b: 2 }`|An object|

### Dates

Note that `date()` is also a [function](query/functions/#dateany)

Literal|Description
-|-
`date(2021-11-11)`|A date, November 11th, 2021
`date(today)`|A date representing the current date
`date(now)`|A date representing the current date and time
`date(tomorrow)`|A date representing tomorrow's date
`date(sow)`|A date representing the start of the current week
`date(eow)`|A date representing the end of the current week
`date(som)`|A date representing the start of the current month
`date(eom)`|A date representing the end of the current month
`date(soy)`|A date representing the start of the current year
`date(eoy)`|A date representing the end of the current year

### Durations
#### Seconds
Literal|Description
-|-
`dur(1 s)`|one second
`dur(3 s)`|three seconds
`dur(1 sec)`|one second
`dur(3 secs)`|three seconds
`dur(1 second)`|one second
`dur(3 seconds)`|three seconds

#### Minutes
Literal|Description
-|-
`dur(1 m)`|one minute|
`dur(3 m)`|three minutes|
`dur(1 min)`|one minute|
`dur(3 mins)`|three minutes|
`dur(1 minute)`|one minute|
`dur(3 minutes)`|three minutes|

#### Hours
Literal|Description
-|-
`dur(1 h)`|one hour|
`dur(3 h)`|three hours|
`dur(1 hr)`|one hour|
`dur(3 hrs)`|three hours|
`dur(1 hour)`|one hour|
`dur(3 hours)`|three hours|

#### Days
Literal|Description
-|-
`dur(1 d)`|one day
`dur(3 d)`|three days
`dur(1 day)`|one day
`dur(3 days)`|three days

#### Weeks
Literal|Description
-|-
`dur(1 w)`|one day
`dur(3 w)`|three days
`dur(1 wk)`|one day
`dur(3 wks)`|three days
`dur(1 week)`|one day
`dur(3 weeks)`|three days

#### Months
Literal|Description
-|-
`dur(1 mo)`|one month
`dur(3 mo)`|three month
`dur(1 month)`|one month
`dur(3 months)`|three months

#### Years
Literal|Description
-|-
`dur(1 yr)`|one year
`dur(3 yrs)`|three years
`dur(1 year)`|one year
`dur(3 years)`|three years

#### Combinations
Literal|Description
-|-
`dur(1 s, 2 m, 3 h)`|three hours, two minutes, and one second
`dur(1 s 2 m 3 h)`|three hours, two minutes, and one second
`dur(1s 2m 3h)`|three hours, two minutes, and one second
`dur(1second 2min 3h)`|three hours, two minutes, and one second
