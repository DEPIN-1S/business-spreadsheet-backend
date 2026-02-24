export default (req,res,next)=>{
  const originalJson = res.json.bind(res);
  res.json = (payload)=>{
    if(payload?.success===false) return originalJson(payload);
    return originalJson({
      success:true,
      message: payload?.message || "",
      data: payload?.data ?? payload ?? null,
      ...(payload?.meta ? { meta: payload.meta } : {})
    });
  };
  next();
};
