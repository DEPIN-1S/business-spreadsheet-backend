import multer from "multer";
import fs from "fs";
import path from "path";

const ensureDir = (dir)=>{ if(!fs.existsSync(dir)) fs.mkdirSync(dir,{ recursive:true }); };

export const pdfUpload = (feature)=>{
  const folder = path.join(process.cwd(),"public/pdf/features",feature);
  ensureDir(folder);
  return multer({
    storage: multer.diskStorage({
      destination:(req,file,cb)=>cb(null,folder),
      filename:(req,file,cb)=>cb(null,Date.now()+path.extname(file.originalname))
    }),
    fileFilter:(req,file,cb)=>{
      if(!(file.mimetype==='application/pdf')) cb(new Error("Only PDF allowed"));
      else cb(null,true);
    }
  });
};
