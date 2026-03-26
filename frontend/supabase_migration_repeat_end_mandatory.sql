-- mandatory repeat_end_date for recurring events (prevents uncapped series)
-- 1. set existing uncapped to start + 365 days (safe default)
update events 
set repeat_end_date = (date::date + interval '365 days')::date 
where repeat is not null and repeat != 'none' and repeat_end_date is null;

-- 2. add not null constraint (only for recurring)
alter table events 
add constraint check_repeat_end_mandatory 
check ((repeat = 'none' or repeat is null or repeat_end_date is not null));

-- 3. index for faster queries
create index if not exists idx_repeat_end_date on events(repeat_end_date) where repeat != 'none';

-- verify
select id, title, date, repeat, repeat_end_date from events where repeat != 'none' order by date desc limit 10;
