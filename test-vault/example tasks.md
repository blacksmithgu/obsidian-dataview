# Tasks
%% 
## All
```dataview
task
```
%% 
## Uncompleted
```dataview
task from -"recipes"
WHERE !completed
```
%% 
## Completed

```dataview
task WHERE completed
```
%%
## Completed on a specific date
```dataview
task where completed
AND completedDate=date(2021-08-06)
```