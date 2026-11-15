export const coverColors = ['#315E5C','#CA5323','#D086AB','#EEEDD9','#E6B545'];
export function randomCoverColor(){return coverColors[Math.floor(Math.random()*coverColors.length)];}
export function coverColor(game){return coverColors.includes(game.cover_color)?game.cover_color:coverColors[Array.from(game.id||'').reduce((sum,c)=>sum+c.charCodeAt(0),0)%coverColors.length];}
export function coverStyle(game){return {backgroundColor:coverColor(game),backgroundImage:game.image_url?`linear-gradient(0deg,#0c1011,transparent),url(${JSON.stringify(game.image_url)})`:'linear-gradient(0deg,rgba(12,16,17,.8),transparent)'};}
export function coverError(file){return !['image/jpeg','image/png','image/webp'].includes(file.type)?'Choose a JPEG, PNG, or WebP photo.':file.size>5242880?'Choose a photo up to 5 MB.':null;}
