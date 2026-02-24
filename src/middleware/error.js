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

  if(err.code==="LIMIT_FILE_SIZE"){
    statusCode=413; message="File too large";
  }

  if(statusCode===500) logger.error(err.stack||err.message);
  else logger.warn(message);

  res.status(statusCode).json({ success:false, message, error:details });
};
