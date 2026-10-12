-- Independent database cleanup; never calls Quick Read code or changes its schedules.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('veeays-traffic-retention','17 19 * * *',$cleanup$delete from veeays_admin.traffic_sessions where created_at<now()-interval '90 days'$cleanup$);
