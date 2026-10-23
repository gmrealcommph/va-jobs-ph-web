import {questionsFor} from './niche-model.js';
const form=document.querySelector('#nf-form');
if(form){
 let answers=JSON.parse(document.querySelector('#nf-data').textContent).answers||{},step=0;
 const host=document.querySelector('#nf-question'),back=document.querySelector('#nf-back'),next=document.querySelector('#nf-next'),error=document.querySelector('#nf-error');
 const draw=()=>{const questions=questionsFor(answers),q=questions[step];host.replaceChildren();
  const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=q.title;legend.tabIndex=-1;field.append(legend);
  const hint=document.createElement('p');hint.id='nf-hint';hint.textContent=q.hint;field.append(hint);field.setAttribute('aria-describedby',hint.id);
  for(const choice of q.choices){const label=document.createElement('label');label.className='nf-option';const input=document.createElement('input');input.type='radio';input.name='choice';input.value=choice.id;input.checked=answers[q.id]===choice.id;label.append(input,document.createTextNode(choice.label));field.append(label);}
  host.append(field);document.querySelector('#nf-progress').textContent=`Question ${step+1} of 14${step>=12?' · Based on your answers':''}`;document.querySelector('#nf-meter').value=step;back.hidden=step===0;next.textContent=step===13?'See my possibilities →':'Continue →';error.textContent='';legend.focus();
 };
 form.addEventListener('submit',e=>{const value=new FormData(form).get('choice');if(!value){e.preventDefault();error.textContent='Choose an answer, or select “Not sure yet”.';return;}
  const q=questionsFor(answers)[step];answers[q.id]=value;
  const validIds=new Set(questionsFor(answers).map(q=>q.id));answers=Object.fromEntries(Object.entries(answers).filter(([id])=>validIds.has(id)));
  if(step<13){e.preventDefault();step++;draw();}else{document.querySelector('#nf-answers').value=JSON.stringify(answers);next.disabled=true;next.textContent='Saving your results…';}
 });
 back.addEventListener('click',()=>{const value=new FormData(form).get('choice');if(value)answers[questionsFor(answers)[step].id]=value;if(step>0)step--;draw();});draw();
}
