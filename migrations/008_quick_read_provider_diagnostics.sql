-- Diagnostic-only extension. No rows, tables, grants or recovery logic change.
begin;
create or replace function public.quick_read_valid_diagnostics(d jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,public as $$
declare field text; section text; item jsonb; total integer:=0;
begin
 if d is null then return true; end if;
 if d->'version'='2'::jsonb then
   if jsonb_typeof(d)<>'object' or octet_length(d::text)>2048
      or (select count(*) from jsonb_object_keys(d))<>13 then return false; end if;
   for field in select jsonb_object_keys(d) loop
     if field not in ('version','kind','provider','code','status','reason','http_status','output_array','output_count','content_array','text_count','text_present','scan_truncated') then return false; end if;
   end loop;
   if d->'kind' is distinct from '"provider_structure"'::jsonb or d->'provider' is distinct from '"openai"'::jsonb then return false; end if;
   foreach field in array array['code','status','reason'] loop
     if jsonb_typeof(d->field) is distinct from 'string' then return false; end if;
   end loop;
   if d->>'code' not in ('response_not_completed','missing_output_array')
      or d->>'status' not in ('completed','incomplete','failed','in_progress','queued','cancelled','missing','other')
      or d->>'reason' not in ('max_output_tokens','content_filter','missing','other') then return false; end if;
   foreach field in array array['output_array','content_array','text_present','scan_truncated'] loop
     if jsonb_typeof(d->field) is distinct from 'boolean' then return false; end if;
   end loop;
   foreach field in array array['output_count','text_count'] loop
     if jsonb_typeof(d->field) is distinct from 'number' or (d->>field)!~'^[0-9]{1,4}$'
        or (d->>field)::integer>(case when field='text_count' then 256 else 1000 end) then return false; end if;
   end loop;
   if d->'http_status'<>'null'::jsonb and (jsonb_typeof(d->'http_status') is distinct from 'number'
      or (d->>'http_status')!~'^[1-5][0-9]{2}$') then return false; end if;
   return true;
 end if;
 if jsonb_typeof(d)<>'object' or octet_length(d::text)>16384 or d->'version' is distinct from '1'::jsonb
    or jsonb_typeof(d->'selection') is distinct from 'object'
    or jsonb_typeof(d->'truncated') is distinct from 'boolean'
    or jsonb_typeof(d->'missing_ids') is distinct from 'array' then return false; end if;
 for field in select jsonb_object_keys(d) loop
   if field not in ('version','source_unit_count','selection','truncated','invalid_reference_count','duplicate_reference_count','invalid_section_count','missing_ids','unknown_field_count') then return false; end if;
 end loop;
 foreach field in array array['source_unit_count','invalid_reference_count','duplicate_reference_count','invalid_section_count','unknown_field_count'] loop
   if jsonb_typeof(d->field) is distinct from 'number' or (d->>field)!~'^[0-9]{1,7}$' or (d->>field)::numeric>1000000 then return false; end if;
 end loop;
 if (d->>'source_unit_count')::integer>250 or jsonb_array_length(d->'missing_ids')>250 then return false; end if;
 for section in select jsonb_object_keys(d->'selection') loop
   if section not in ('about_role','responsibilities','requirements','nice_to_have','important_requirements','benefits','company_overview','application_notes','other_details')
      or jsonb_typeof(d->'selection'->section)<>'array' then return false; end if;
   for item in select value from jsonb_array_elements(d->'selection'->section) loop
     total:=total+1;
     if total>512 then return false; end if;
     if item<>'null'::jsonb and (jsonb_typeof(item)<>'number' or item::text!~'^-?[0-9]{1,7}$' or abs(item::text::numeric)>1000000) then return false; end if;
   end loop;
 end loop;
 for item in select value from jsonb_array_elements(d->'missing_ids') loop
   if jsonb_typeof(item)<>'number' or item::text!~'^[0-9]{1,3}$' or item::text::integer>=250 then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
commit;
