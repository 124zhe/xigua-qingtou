// Recover only missing classification metadata for profiles imported before 0.3.3.
// The stored resume and existing editable facts are never overwritten here.
export async function prepareProfile(profile,{onProgress=()=>{}}={}){
  const next=QT.sanitize(profile);
  const needsSource=next.experiences.some(row=>!QTMatch.experienceType(row).type);
  if(!needsSource||!next.attachment)return {profile:next,restored:0};
  try{
    onProgress('正在从已保存的简历补充经历归属…');
    await import('./resume-parser.js');
    const {readResume}=await import('./resume-reader.mjs');
    const a=next.attachment,bytes=Uint8Array.from(atob(a.data.split(',')[1]),c=>c.charCodeAt(0));
    const read=await readResume(new File([bytes],a.name,{type:'application/pdf'}));
    const parsed=QTResume.parse(read.lines,next).profile;
    let restored=0;
    for(const row of next.experiences){
      if(row.experienceType||row.sourceSection)continue;
      const matches=parsed.experiences.filter(candidate=>QTResume.matchRows('experiences',row,candidate));
      if(matches.length!==1)continue;
      row.sourceSection=matches[0].sourceSection;
      // Keep an inferred type as a hint from the source, so it can be reviewed.
      if(QTMatch.experienceType(row).type)restored++;
    }
    return {profile:next,restored};
  }catch{
    return {profile:next,restored:0,warning:'已保存的简历暂时无法读取，请在资料页补充经历类型；已有内容仍可使用。'};
  }
}
