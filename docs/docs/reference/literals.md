# Literals

Dataview query language *literals* are **expressions** which represent constant values like a text (`"Science"`) or a number (`2021`). They can be used as part as [functions](functions.md) or of [expressions like comparison](./expressions.md). Some examples of [Queries](../queries/structure.md) that use **literals**:

~~~

Literal (number) 2022 used in a comparison
```dataview
LIST
WHERE file.day.year = 2022
```

Literal (text) "Math" used in a function call
```dataview
LIST
WHERE contains(file.name, "Math")
```

Literal (link) [[Study MOC]] used as a source
```dataview
LIST
FROM [[Study MOC]]
```

Literal (date) date(yesterday) used in a comparison
```dataview
TASK
WHERE !completed AND file.day = date(yesterday)
```

Literal (duration) dur(2 days) used in a comparison
```dataview
LIST
WHERE end - start > dur(2 days)
```
~~~

!!! summary "Literals"
    Literals are **static values** that can be used as part of the Dataview Query Language (DQL), i.e. for comparisons.

The following is an extensive, but non-exhaustive list of possible literals in DQL.

### General
Literal|Description
-|-
`0`|The number zero
`1337`|The positive number 1337
`-200`| The negative number -200
`"The quick brown fox jumps over the lazy dog"`| Text (sometimes referred to as "string")
`[[Science]]`|A link to the file named "Science"
`[[]]`| A link to the current file
`[1, 2, 3]`|A list of numbers 1, 2, and 3
`[[1, 2],[3, 4]]`|A list of list [1, 2] and [3, 4]
`{ a: 1, b: 2 }`| An object with keys a and b, whereas a has value 1, b 2. |
`date(2021-07-14)`| A date (read more below) |
`dur(2 days 4 hours)` | A duration (read more below) | 

!!! attention "Literals as field values"
    Literals are only interpreted this way when used inside a Query, not when used as a meta data value. For possible values and their data types for fields, please refer to [Types of Metadata](../annotation/types-of-metadata.md).

### Dates

Whenever you use a [field value in Date ISO format](../annotation/types-of-metadata.md#date), you'll need to compare these fields against date objects. Dataview provides some shorthands for common use cases like tomorrow, start of current week etc. Please note that `date()` is also a [function](functions.md#dateany), which can be called on **text** to extract dates.

Literal|Description
-|-
`date(2021-11-11)`|A date, November 11th, 2021
`date(2021-09-20T20:17)`| A date, September 20th, 2021 at 20:17
`date(today)`|A date representing the current date
`date(now)`|A date representing the current date and time
`date(tomorrow)`|A date representing tomorrow's date
`date(yesterday)`|A date representing yesterday's date
`date(sow)`|A date representing the start of the current week
`date(eow)`|A date representing the end of the current week
`date(som)`|A date representing the start of the current month
`date(eom)`|A date representing the end of the current month
`date(soy)`|A date representing the start of the current year
`date(eoy)`|A date representing the end of the current year

### Durations

Durations are representatives of a time span. You can either [define them directly](../annotation/types-of-metadata.md#duration) or create them due to [calculating with dates](../annotation/types-of-metadata.md#duration), and use these for i.e. comparisons.

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
`dur(1 m)`|one minute
`dur(3 m)`|three minutes
`dur(1 min)`|one minute
`dur(3 mins)`|three minutes
`dur(1 minute)`|one minute
`dur(3 minutes)`|three minutes

#### Hours
Literal|Description
-|-
`dur(1 h)`|one hour
`dur(3 h)`|three hours
`dur(1 hr)`|one hour
`dur(3 hrs)`|three hours
`dur(1 hour)`|one hour
`dur(3 hours)`|three hours

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
`dur(1 w)`|one week
`dur(3 w)`|three weeks
`dur(1 wk)`|one week
`dur(3 wks)`|three weeks
`dur(1 week)`|one week
`dur(3 weeks)`|three weeks

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
