import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('three-step navigation validates both work groups, pay and final experience without losing choices',()=>{
  function element(){return {hidden:false,style:{},textContent:'',listeners:{},classList:{toggle(){}},setAttribute(){},removeAttribute(){},focus(){},remove(){},addEventListener(name,fn){this.listeners[name]=fn;}};}
  const steps=Array.from({length:3},()=>{const el=element();el.querySelector=()=>element();return el;});
  const dots=Array.from({length:3},()=>{const el=element();el.querySelector=()=>element();return el;});
  const selections={target_roles:[{}],employment_types:[{}],schedule_preferences:[],experience_level:[]};
  const ids=Object.fromEntries(['onboarding-form','onboard-back','onboard-next','onboard-finish','minimum_salary_usd','salary-php'].map(id=>[id,element()]));
  const form=ids['onboarding-form'],salary=ids.minimum_salary_usd;
  let validPay=true,reports=0;salary.value='1000';salary.checkValidity=()=>validPay;salary.reportValidity=()=>reports++;
  form.querySelectorAll=selector=>selector==='.onboard-step'?steps:selections[selector.match(/name="([^"]+)"/)[1]];
  runInNewContext(readFileSync(new URL('../public/onboarding.js',import.meta.url),'utf8'),{document:{getElementById:id=>ids[id],querySelectorAll:()=>dots},window:{scrollTo(){}}});
  const next=()=>ids['onboard-next'].listeners.click();
  assert.equal(steps[0].hidden,false);next();assert.equal(steps[1].hidden,false);
  next();assert.equal(steps[1].hidden,false,'schedule is required even with employment selected');
  selections.schedule_preferences=[{}];validPay=false;next();assert.equal(steps[1].hidden,false);assert.equal(reports,1);
  validPay=true;next();assert.equal(steps[2].hidden,false);assert.equal(ids['onboard-finish'].hidden,false);assert.equal(ids['onboard-next'].hidden,true);
  let prevented=false;form.listeners.submit({preventDefault(){prevented=true;}});assert.equal(prevented,true);
  selections.experience_level=[{}];prevented=false;form.listeners.submit({preventDefault(){prevented=true;}});assert.equal(prevented,false);
  ids['onboard-back'].listeners.click();assert.equal(steps[1].hidden,false);assert.equal(salary.value,'1000');
});

