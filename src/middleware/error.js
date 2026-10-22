import logger from "../config/logger.js";

export default (err, req, res, next)=>{
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let details = err.details || null;

  if(err.name==="SequelizeValidationError"){
    statusCode = 422;
    message = "Validation error";
    details = err.errors.map(e=>({ field:e.path, message:e.message }));
  }

  if(err.name==="SequelizeUniqueConstraintError"){
    statusCode = 409;
    message = "Duplicate entry";
    details = err.errors.map(e=>({ field:e.path, message:e.message }));
  }

  if(err.name==="JsonWebTokenError"){
    statusCode=401; message="Invalid token";
  }

  if(err.name==="TokenExpiredError"){
    statusCode=401; message="Token expired";
  }

  if(err.code==="LIMIT_FILE_SIZE" || err.name==="MulterError" && err.code==="LIMIT_FILE_SIZE"){
    statusCode=413; message="File too large. Max 50MB per file.";
  } else if(err.name==="MulterError"){
    statusCode=400;
    message = err.code==="LIMIT_FILE_COUNT"
      ? "Too many files. Upload up to 20 at a time."
      : (err.message || "Upload failed");
  } else if(/boundary|Unexpected end of form|Multipart/i.test(err.message||"")){
    statusCode=400;
    message="The photo did not reach the server. Try one smaller image.";
  }

  if(statusCode===500) logger.error(err.stack||err.message);
  else logger.warn(message);

  res.status(statusCode).json({ success:false, message, error:details });
};
