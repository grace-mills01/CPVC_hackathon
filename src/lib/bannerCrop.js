export const defaultFrame = {x:50, y:50, zoom:1};
export function cropRectangle(width, height, frame = defaultFrame) {
 const clamp = (value, min, max, fallback) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
 const zoom = clamp(frame.zoom, 1, 3, 1);
 const cropWidth = Math.min(width, height * 2) / zoom;
 const cropHeight = cropWidth / 2;
 return {x:(width-cropWidth)*clamp(frame.x,0,100,50)/100,
  y:(height-cropHeight)*clamp(frame.y,0,100,50)/100, width:cropWidth, height:cropHeight};
}
export function drawBanner(canvas, image, frame) {
 const crop = cropRectangle(image.naturalWidth, image.naturalHeight, frame);
 const context = canvas.getContext('2d');
 if(!context) throw new Error('Your browser could not prepare this photo. Try another browser.');
 context.clearRect(0,0,canvas.width,canvas.height);
 context.drawImage(image,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);
}
export function loadPhoto(file) {
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file), image=new Image();
  image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
  image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('This photo could not be opened. Choose another JPEG, PNG, or WebP image.'))};
  image.src=url;
 });
}
export async function cropBanner(file, frame) {
 const image = await loadPhoto(file);
 const crop = cropRectangle(image.naturalWidth,image.naturalHeight,frame);
 const canvas = document.createElement('canvas');
 canvas.width=Math.min(1600,Math.max(2,Math.round(crop.width)));
 canvas.height=Math.round(canvas.width/2);
 drawBanner(canvas,image,frame);
 const blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob || blob.size>5242880)throw new Error('The framed photo is too large. Try a smaller image.');
 return new File([blob],'activity-banner.png',{type:'image/png'});
}
