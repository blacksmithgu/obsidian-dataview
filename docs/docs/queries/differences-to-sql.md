<!--
 * @Author: chinesehamburger 2576226012@qq.com
 * @Date: 2024-12-12 14:24:45
 * @LastEditors: chinesehamburger 2576226012@qq.com
 * @LastEditTime: 2024-12-13 16:40:43
 * @FilePath: \obsidian-dataview\docs\docs\queries\differences-to-sql.md
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
# Dataview Query Language (DQL) and SQL

If you are familiar with SQL and experienced in writing SQL queries, you might approach writing a DQL query in a similar way. However, DQL is significantly different from SQL.

A DQL query is **executed from top to bottom**, line-by-line. It is more like a computer program than a typical SQL query.

When a line is evaluated, it produces a result set and **passes the whole set on to the next DQL line** which will manipulate the set that it received from the previous line. This is why in DQL it is possible, for example, to have multiple WHERE clauses. But in DQL it is not a 'clause' but a 'data command'. Every line of a DQL query (except the 1st and 2nd lines) is a 'data command'.

## Anatomy of a DQL query

Instead of starting with SELECT, a DQL query starts with a word determining the Query Type, which determines how your final result will be rendered on screen (a table, a list, a task list, or a calendar). Then follows the list of fields, which is actually very similar to the column list you put after a SELECT statement.

The next line starts with FROM which is not followed by a table name but by a complex expression, similar to an SQL WHERE clause. Here you can filter on many things, like tags in files, file names, path names, etc. In the background, this command already produces a result set which will be our initial set for further data manipulation by 'data commands' on subsequent lines.

You can have as many following lines as you want. Each will start with a [data command](data-commands.md) and will re-shape the result set it received from the previous line. For example:

- The WHERE data command will only keep those lines from the result set which match a given condition. This means that, unless all data in the result set matches the condition, this command will pass on a smaller result set to the next line than it received from the previous line. Unlike in SQL, you can have as many WHERE commands as you like.
- The FLATTEN data command is not found in common SQL but in DQL you can use it to reduce the depth of the result set.
- DQL, similarly to SQL, has a GROUP BY command but this can also be used multiple times, which is not possible in common SQL. You can even do several SORT or GROUP BY commands one after the other.
