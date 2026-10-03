// The placeholder remains visible until the image has actually decoded.
export function installLogoFallback(image) {
  const ready=()=>{
    if(image.naturalWidth>0) image.parentElement.classList.add('qr-logo-loaded');
    else fail();
  };
  const fail=()=>{
    image.parentElement.classList.remove('qr-logo-loaded');
    image.hidden=true;
  };
  image.addEventListener('load',ready);
  image.addEventListener('error',fail);
  if(image.complete) ready();
}
if(typeof document!=='undefined') document.querySelectorAll('[data-company-logo]').forEach(installLogoFallback);
