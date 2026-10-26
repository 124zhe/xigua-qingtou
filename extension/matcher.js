(function () {
  'use strict';
  const normalize = s => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[\s\-_:：*＊()（）【】\[\]\/·.]/g, '');
  function labelText(value){
    return String(value??'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\uE000-\uF8FF]/g,'')
      .replace(/[（(【\[]\s*(?:(?:必填|选填|required|optional)\s*[,，;；]?\s*)?(?:(?:最多|不超过|限|限填|至多)?\s*\d+\s*(?:字|字符|个字符|characters?)(?:以内|内)?)?\s*[)）】\]]/gi,'')
      .replace(/(?:\s+|[（(])\d+\s*\/\s*\d+(?:[)）])?\s*$/,'')
      .replace(/^[*＊\s]+|[*＊:：?？\s]+$/g,'').replace(/^(?:请输入|请选择|请填写|请提供|填写|输入|please\s+(?:enter|select|provide)\s+|your\s+)/i,'').trim();
  }
  function sectionKind(value){
    const n=normalize(value),kinds=[];
    const heading=n.replace(/(?:必填|required|选填|optional)$/,'').replace(/\d+$/,'');
    if(/教育|学历信息|学习经历|学业经历|education|academicbackground/.test(n))kinds.push('educations');
    if(/实习|工作经历|工作经验|工作履历|职业履历|任职经历|职业经历|实践经历|internship|workexperience|employment|professionalexperience/.test(n))kinds.push('experiences');
    const research=/^(?:科研|科学研究|研究|课题研究|课题)(?:经历|经验|背景)(?:信息)?$|^research(?:experience|background)$|^(?:科研|研究|课题研究)经历researchexperience$/.test(heading);
    if(/项目|project/.test(n)||research||(kinds.length&&/科研经历|科学研究经历|课题研究经历|研究经历|researchexperience/.test(n)))kinds.push('projects');
    return kinds.length===1?kinds[0]:'';
  }
  function sectionExperienceType(title){
    const n=normalize(title),intern=/实习|intern/.test(n),work=/工作|职业|employment|workexperience|professionalexperience/.test(n);
    if(intern&&work)return '';
    if(intern)return '实习';
    if(work)return '正式工作';
    if(/实践|创作|个人项目|practice/.test(n))return '其他实践';
    return '';
  }
  function educationRank(row){
    const levels=[[/^(?:小学|初等教育|primaryschool)$/,1],[/^(?:初中|初级中学|juniormiddleschool)$/,2],[/^(?:高中|普通高中|高级中学|中专|中等专业学校|职高|职业高中|技校|highschool)$/,3],[/^(?:专科|大专|大学专科|高职|associate)$/,4],[/^(?:本科|大学本科|学士|学士学位|bachelor|bachelors|undergraduate)$/,5],[/^(?:硕士|硕士研究生|硕士学位|master|masters)$/,6],[/^(?:博士|博士研究生|博士学位|phd|doctor|doctorate)$/,7]];
    for(const value of [row?.education,row?.degree]){const n=normalize(value);for(const [pattern,rank] of levels)if(pattern.test(n))return rank;}
    return 0;
  }
  function educationOrder(profile){
    const start=row=>/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(row.startDate||'')?row.startDate.padEnd(10,'0'):'9999';
    return (profile.educations||[]).map((row,index)=>({row,index,rank:educationRank(row)||Infinity})).sort((a,b)=>a.rank-b.rank||start(a.row).localeCompare(start(b.row))||a.index-b.index).map(x=>x.index);
  }
  function experienceType(row){
    if(['实习','正式工作','其他实践'].includes(row.experienceType))return {type:row.experienceType,basis:'已保存的经历类型'};
    if(/实习|\bintern(?:ship)?\b/i.test(row.role||''))return {type:'实习',basis:'岗位名称明确包含实习'};
    if(/自媒体创作者|独立创作者|个人创作|个人项目|independent creator/i.test(row.role||''))return {type:'其他实践',basis:'个人创作／实践岗位'};
    const type=sectionExperienceType(row.sourceSection||'');
    return {type,basis:type?'简历栏目：'+row.sourceSection:''};
  }
  const aliases = {
    'basic.name': ['姓名', '中文姓名', '真实姓名', 'name', 'fullname', 'yourname'],
    'basic.phone': ['手机', '手机号', '手机号码', '联系电话', '移动电话', 'phone', 'mobile', 'phonenumber', 'telephone'],
    'basic.email': ['邮箱', '电子邮箱', '电子邮件', '联系邮箱', 'email', 'emailaddress'],
    'basic.city': ['现居地', '现居城市', '现居住地', '现居住城市', '居住地', '居住城市', '目前居住地', '当前居住地', '目前居住城市', '当前居住城市', '所在城市', '所在地', 'currentcity', 'currentresidence', 'city'],
    'basic.nationality': ['国籍','国籍/地区','国籍或地区','国籍（国家/地区）','国家/地区（国籍）','nationality','nationality/region','nationalityorregion','nationality/countryorregion','citizenship','countryofcitizenship','country/regionofcitizenship'],
    'basic.gender': ['性别', 'gender', 'sex'],
    'basic.birthDate': ['出生日期', '出生日期年龄', '生日', 'dateofbirth', 'birthdate', 'birthday'],
    'basic.birthMonth': ['出生年月', '出生月份', 'birthmonth'],
    'basic.ethnicity': ['民族', 'ethnicity'],
    'basic.nativePlace': ['籍贯', 'nativeplace'],
    'basic.studentOrigin': ['生源地','生源地区','生源所在地','生源地（高考所在地）','studentorigin'],
    'basic.cet4Score': ['CET-4成绩', 'CET4分数', '英语四级成绩', '四级成绩'],
    'basic.cet6Score': ['CET-6成绩', 'CET6分数', '英语六级成绩', '六级成绩'],
    'basic.honors': ['奖励荣誉', '获奖情况', '奖励情况', '荣誉奖励', 'awards', 'honors'],
    'basic.patents': ['专利', '专利情况', '发明专利', 'patents'],
    'basic.politicalStatus': ['政治面貌', 'politicalstatus'],
    'basic.english': ['英语水平', '英语等级', '外语水平', 'englishlevel', '英语能力'],
    'basic.website': ['个人网站', '作品集链接', '个人主页', 'portfolio', 'portfoliourl', 'personalwebsite', 'website', 'github'],
    'basic.skills': ['技能', '专业技能', '技能特长', 'skills', 'technicalskills'],
    'basic.introduction': ['自我介绍', '自我评价', '自我描述', '个人简介', '个人总结', 'selfintroduction', 'summary'],
    'basic.desiredRole': ['意向岗位', '期望岗位', '应聘岗位', '申请职位', 'desiredposition'],
    'basic.desiredCity': ['意向城市', '期望城市', '期望工作地', '期望工作城市', '工作地点意向', 'preferredlocation'],
    'educations.school': ['学校', '学校名称', '毕业院校', '院校', '院校名称', 'school', 'university', 'institution'],
    'educations.major': ['专业', '所学专业', '专业名称', 'major', 'fieldofstudy'],
    'educations.college': ['学院', '院系', '学院/系', '所在院系', '就读院系', '学院名称', 'department'],
    'educations.courses': ['核心课程', '主修课程', '专业课程', 'courses'],
    'educations.education': ['学历', '最高学历', 'educationlevel', 'qualification'],
    'educations.studyMode': ['教育类型','学习形式','培养方式'],
    'educations.degreeCategory': ['学位分类','最高学历的学位分类'],
    'educations.studyLength': ['学制','最高学历的学制'],
    'educations.schoolRegion': ['毕业院校所在国家/地区'],
    'educations.degree': ['学位', '最高学位', 'degree'],
    'educations.gpa': ['gpa', '平均绩点', '绩点', 'gradepointaverage'],
    'educations.gradeRank': ['成绩排名', '专业排名', '学习成绩排名', '班级排名', '排名', 'graderank', 'classrank', 'classranking'],
    'educations.laboratory': ['实验室', 'laboratory'],
    'educations.researchField': ['领域方向', '研究方向', 'researchfield'],
    'educations.supervisor': ['导师', '导师姓名', 'supervisor'],
    'educations.startDate': ['入学时间', '入学日期', 'enrollmentdate', 'dateofenrollment', 'enrolmentdate', 'admissiondate'],
    'educations.endDate': ['毕业时间', '毕业日期', '预计毕业时间', '预计毕业日期', '毕业或预计毕业时间', '获得毕业证或学位证时间', 'graduationdate', 'dateofgraduation', 'expectedgraduationdate', 'expectedgraduationmonth'],
    'experiences.company': ['公司', '公司名称', '实习单位', '实习公司', '工作单位', '单位名称', 'employer', 'company', 'companyname'],
    'experiences.role': ['实习职位', '实习岗位', '工作岗位', '职务', '职位名称', '担任职位', 'jobtitle', 'position'],
    'experiences.department': ['任职部门', '工作部门', '实习部门', '所在部门', '所属部门', '部门名称', '业务部门', 'workdepartment', 'employmentdepartment'],
    'experiences.experienceType': ['工作性质', '任职性质', 'employmenttype'],
    'experiences.description': ['工作内容', '工作职责', '实习职责', '实习内容', '工作描述', '职责描述', '实习描述', 'responsibilities', 'jobdescription'],
    'projects.name': ['项目名称', '项目名', 'projectname', 'projecttitle'],
    'projects.role': ['项目角色', '承担角色', '项目职责', '项目中职责', 'projectrole'],
    'projects.description': ['项目描述', '项目内容', '项目介绍', '项目经历', 'projectdescription'],
  };
  const ambiguous = { startDate: ['开始时间', '开始日期', '起始时间', '起始日期', 'startdate', 'from'], endDate: ['结束时间', '结束日期', '截止时间', 'enddate', 'to'], role: ['职位', '岗位', '角色', '职责', 'role'], description: ['描述', '内容', 'description'], name: ['名称'] };
  const knownManual={最近公司:'请手动指定最近公司；个人实践不一定属于雇佣经历',工作经验:'请按网站选项确认工作年限，不能由实习时间推算',当前薪资:'资料未设置当前薪资，请在网站手动填写',期望薪资:'资料未设置期望薪资，请在网站手动填写',语言类型:'请明确语言种类，可在自定义模块中添加语言能力',掌握程度:'请按实际语言能力选择；不根据考试分数推断',听说:'请按实际听说能力选择',读写:'请按实际读写能力选择',获奖时间:'请在奖励荣誉模块中补充奖项和获奖时间',奖项名称:'请在奖励荣誉模块中逐条添加奖项'};
  const sensitive = /身份证|证件号码|证件类型|身份证号|护照|密码|验证码|银行账号|银行卡|紧急(?:情况(?:下|时)?)?联[系络]人|应急联[系络]人|家庭成员|亲属|推荐人|password|captcha|verificationcode|passport|idcard|ssn|emergency|referencecontact/i;
  const identityAliases={documentNumber:['证件号','证件号码','身份证号','身份证号码','居民身份证号码','idnumber','idcard','idcardnumber','documentnumber','cardnum'],documentType:['证件类型','证件种类','证件类别','documenttype','idtype','cardtype']};
  function identityKey(label){const n=normalize(questionText(label)).replace(/^your/,'');return Object.keys(identityAliases).find(k=>identityAliases[k].includes(n))||'';}
  const emergencyAliases={emergencyName:['紧急联系人','紧急联系人姓名','紧急联络人','紧急联络人姓名','应急联系人','应急联系人姓名','emergencycontact','emergencycontactname'],emergencyPhone:['紧急联系电话','紧急联络电话','紧急联系人电话','紧急联系人联系电话','紧急联系人手机','紧急联系人手机号','紧急联系人手机号码','紧急联络人电话','emergencycontactphone','emergencycontactphonenumber','emergencycontactmobile'],emergencyRelation:['与紧急联系人关系','与紧急联系人的关系','紧急联系人与本人关系','紧急联系人关系','紧急联络人关系','emergencycontactrelationship']};
  for(const prefix of ['紧急情况联系人','紧急情况下联系人','紧急情况时联系人','紧急情况联络人','紧急情况下联络人','紧急情况时联络人']){
    emergencyAliases.emergencyName.push(prefix,prefix+'姓名');
    emergencyAliases.emergencyPhone.push(...['电话','联系电话','手机','手机号','手机号码'].map(suffix=>prefix+suffix));
    emergencyAliases.emergencyRelation.push(prefix+'关系',prefix+'与本人关系','与'+prefix+'关系','与'+prefix+'的关系');
  }
  emergencyAliases.emergencyPhone.push('紧急情况联系电话','紧急情况下联系电话','紧急情况时联系电话','紧急情况联络电话');
  function emergencyKey(label){const n=normalize(questionText(label));return Object.keys(emergencyAliases).find(k=>emergencyAliases[k].includes(n))||'';}
  const manualOnly=label=>sensitive.test(label)&&!identityKey(label)&&!emergencyKey(label);
  function identityValue(profile,key){
    const field=key.split('.').pop(),direct=profile.basic?.[field];if(direct)return String(direct);
    const values=(profile.custom||[]).filter(c=>!manualOnly(c.label)&&questionNames(c).some(n=>identityKey(n)===field)&&!questionNameConflict(c)).map(c=>c.value);
    for(const m of profile.modules||[]){if(/家庭|亲属|紧急(?:情况(?:下|时)?)?联[系络]人|应急联[系络]人|推荐人|family|emergency|referencecontact/i.test([m.name,...(m.aliases||[])].join(' ')))continue;for(const f of m.fields||[]){if([f.label,...(f.aliases||[])].some(n=>identityKey(n)===field))for(const e of m.entries||[])values.push(e.values?.[f.id]);}}
    const unique=[...new Set(values.filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()))];return unique.length===1?unique[0]:'';
  }
  function exactField(label, kind) {
    const n = normalize(labelText(label));
    const contact=emergencyKey(label);if(contact)return {key:'basic.'+contact};
    if(kind==='emergency'){
      if(['姓名','联系人','联系人姓名','name','contactname'].includes(n))return {key:'basic.emergencyName'};
      if(['电话','手机','手机号','手机号码','联系电话','电话号码','phone','mobile','phonenumber'].includes(n))return {key:'basic.emergencyPhone'};
      if(['关系','与本人关系','与申请人关系','relationship','relation'].includes(n))return {key:'basic.emergencyRelation'};
      return {key:null,reason:'请补充紧急联系人的对应资料'};
    }
    if(n==='department'||n==='部门')return kind==='experiences'?{key:'experiences.department'}:kind==='educations'?{key:'educations.college'}:{key:null,reason:'请确认此处是任职部门还是就读院系'};
    if(n==='主要职责与业绩')return ['experiences','projects'].includes(kind)?{key:kind+'.description'}:{key:null,reason:'请先确认这段属于工作还是项目经历'};
    const identity=identityKey(n);if(identity)return {key:'basic.'+identity};
    if (manualOnly(n)) return { key: null, reason: '此字段由你手动填写' };
    for (const [k, list] of Object.entries(aliases)) if (list.some(s => normalize(s) === n)) {
      const group = k.split('.')[0];
      if(kind&&['experiences','projects','educations'].includes(kind)&&['所在地','city'].includes(n))return {key:null,reason:'此处是经历所在地，请手动填写',recognized:true};
      if (kind && ['educations', 'experiences', 'projects'].includes(group) && kind !== group) return { key: null, reason: '字段与所属经历不一致' };
      return { key: k };
    }
    if (kind) for (const [k, list] of Object.entries(ambiguous)) if (list.some(s => normalize(s) === n)) return { key: kind + '.' + (k === 'name' && kind === 'experiences' ? 'company' : k === 'name' && kind === 'educations' ? 'school' : k) };
    if(knownManual[n])return {key:null,reason:knownManual[n],recognized:true};
    return { key: null, reason: '未确定字段含义' };
  }
  // Anchored phrase rules recognize equivalent labels, never arbitrary substrings.
  // In particular, company address, expected position and work department stay distinct.
  function equivalentField(label,kind){
    const n=normalize(labelText(label)),hits=[];
    const add=(key,pattern)=>{if(pattern.test(n))hits.push(key);};
    add('experiences.company',/^(?:(?:任职|就职|所在|所属|实习|工作)(?:的)?)?(?:公司|单位|企业|机构)(?:名称|全称|中文名称|中文全称)?$|^(?:company|employer|organization)(?:name|fullname)?$/);
    add('experiences.role',/^(?:(?:担任|所任|任职|实习|工作|所在)(?:的)?)?(?:岗位|职位|职务)(?:名称)?$|^(?:job|position|employment|internship)(?:title|name)$/);
    add('experiences.department',/^(?:(?:任职|就职|所在|所属|实习|工作)(?:的)?)?(?:部门|团队)(?:名称|全称)?$/);
    add('educations.school',/^(?:毕业|就读|在读|所在)?(?:院校|学校|大学)(?:名称|全称|中文名称|中文全称)?$|^(?:school|university|institution)(?:name|fullname)$/);
    add('educations.college',/^(?:就读|在读|所在|所属)?(?:学院|院系|系所)(?:名称|全称)?$|^(?:college|faculty|academicdepartment)(?:name)?$/);
    add('educations.major',/^(?:最高学历的?)?(?:所学|就读|在读|主修)?专业(?:名称|全称)?$|^(?:major|fieldofstudy)(?:name)?$/);
    add('educations.education',/^(?:最高|所获|取得)?学历(?:层次|类别|名称)?$|^(?:academic|education|educational)(?:level|qualification)$/);
    add('educations.degree',/^(?:最高|所获|取得|获得)?学位(?:类别|名称)?$/);
    add('educations.startDate',/^(?:入学|入校|开始就读|开始学习)(?:时间|日期|年月)$/);
    add('educations.endDate',/^(?:毕业(?:或预计毕业)?|预计毕业|预期毕业|预定毕业|预毕业)(?:时间|日期|年月)$/);
    if(kind==='experiences'){
      add('experiences.startDate',/^(?:入职|入司|开始任职|(?:工作|实习)(?:开始|起始))(?:时间|日期|年月)$|^(?:employment|work|internship)(?:startdate|startmonth)$|^(?:dateofjoining|joiningdate)$/);
      add('experiences.endDate',/^(?:离职|离司|结束任职|(?:工作|实习)(?:结束|终止|截止))(?:时间|日期|年月)$|^(?:employment|work|internship)(?:enddate|endmonth)$|^(?:dateofleaving|leavingdate)$/);
    }
    add('projects.name',/^(?:(?:科研|研究)?(?:项目|课题))(?:名称|全称|题目)$/);
    add('projects.role',/^(?:在)?(?:科研项目|研究项目|科研课题|研究课题|项目|课题)(?:中)?(?:担任的?|承担的?)?(?:角色|职位|职务)$/);
    add('projects.description',/^(?:科研项目|研究项目|科研课题|研究课题)(?:描述|内容|介绍)$/);
    if(kind==='projects'){
      add('projects.role',/^(?:承担|担任)(?:的)?角色$/);
      add('projects.description',/^(?:职责内容|(?:科研|研究|课题)(?:内容|描述|工作内容|职责))$/);
      add('projects.startDate',/^(?:科研项目|研究项目|科研课题|研究课题|项目|课题)(?:开始|起始)(?:时间|日期|年月)$/);
      add('projects.endDate',/^(?:科研项目|研究项目|科研课题|研究课题|项目|课题)(?:结束|终止|截止)(?:时间|日期|年月)$/);
    }
    add('basic.phone',/^(?:本人|个人|联系)?(?:手机|移动电话)(?:号码|号)?$|^(?:mobile|cellphone|phonenumber|mobilenumber|contactnumber|telephonenumber|mobilephone(?:number)?)$/);
    add('basic.email',/^(?:本人|个人|联系)?(?:电子)?(?:邮箱|邮件)(?:地址)?$|^email(?:address)?$/);
    add('basic.desiredRole',/^(?:应聘|申请|期望|意向|求职意向)(?:职位|岗位)(?:名称)?$/);
    const group=['experiences','projects'].includes(kind)?kind:/^(?:工作|岗位|实习|job|work)/.test(n)?'experiences':/^项目|^project/.test(n)?'projects':'';
    if(group)add(group+'.description',/^(?:主要)?(?:(?:工作|岗位|实习|项目)(?:的)?)?(?:主要)?(?:职责|内容|描述|负责内容|承担工作|工作职责|工作内容|职责描述|工作描述)(?:(?:及|与|和|以及|&|、|\/)(?:工作)?(?:业绩|成果|成绩|成就|贡献|内容))?$|^(?:主要)?(?:业绩|成果|工作业绩|工作成果)$|^(?:job|work|project)?(?:description|duties|responsibilities)(?:and(?:achievements|results))?$/);
    if(['educations','experiences','projects'].includes(kind)){
      add(kind+'.startDate',/^(?:起始|开始|起)(?:时间|日期|年月)$|^start(?:date|time|month)$/);
      add(kind+'.endDate',/^(?:结束|终止|截止|止)(?:时间|日期|年月)$|^end(?:date|time|month)$/);
    }
    const unique=[...new Set(hits)];
    if(unique.length!==1)return {key:null,reason:unique.length?'字段含义不唯一，请核对':'未确定字段含义'};
    const key=unique[0],family=key.split('.')[0];
    if(kind&&['educations','experiences','projects'].includes(family)&&kind!==family)return {key:null,reason:'字段与所属经历不一致'};
    return {key,match:'equivalent'};
  }
  function fieldKey(label,kind){
    const clean=labelText(label),direct=exactField(clean,kind);if(direct.key||direct.recognized||manualOnly(clean)||kind==='emergency')return direct;
    const whole=equivalentField(clean,kind);if(whole.key)return whole;
    const parts=clean.split(/[\/|｜、&＆()（）]/).map(labelText).filter(Boolean);
    if(parts.length>1){
      const matches=parts.map(p=>{const d=exactField(p,kind);return d.key?d:equivalentField(p,kind);});
      const keys=[...new Set(matches.map(m=>m.key).filter(Boolean))];
      if(keys.length===1&&matches.every(m=>m.key))return {key:keys[0],match:'equivalent'};
      if(keys.length>1)return {key:null,reason:'同一标签包含不同资料项，请核对'};
    }
    return direct;
  }
  const optionGroups = [ ['身份证','居民身份证','中华人民共和国居民身份证'], ['本科', '大学本科', 'bachelor', 'bachelors', 'undergraduate'], ['硕士', '硕士研究生', 'master', 'masters'], ['博士', '博士研究生', 'phd', 'doctor'], ['专科', '大专', '大学专科'], ['学士', '学士学位'], ['男', '男性', 'male'], ['女', '女性', 'female'], ['共青团员', '团员'], ['中共党员', '党员'], ['群众', '无党派群众'], ['cet6', '英语六级', '大学英语六级', '六级'], ['cet4', '英语四级', '大学英语四级', '四级'] ].map(g => g.map(normalize));
  function optionScore(value, option) {
    const a = normalize(value), b = normalize(option);
    if (!a || !b || /^(请选择|please.?select|selectan?)/i.test(b)) return 0;
    if (a === b) return 100;
    const am=a.match(/^(非全日制|全日制)(.+)$/),bm=b.match(/^(非全日制|全日制)(.+)$/);
    if(am&&bm&&am[1]===bm[1])return optionScore(am[2],bm[2]);
    return optionGroups.some(g => g.includes(a) && g.includes(b)) ? 90 : 0;
  }
  function chooseOption(value, options) {
    const scored = options.map(o => ({ ...o, score: optionScore(value, o.label) })).filter(o => o.score > 0).sort((a,b) => b.score-a.score);
    return scored.length && !(scored[1] && scored[1].score === scored[0].score) ? scored[0] : null;
  }
  function isFullDate(value){
    if(!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value||''))return false;
    const date=new Date(value+'T00:00:00Z');
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
  }
  function resolve(profile, key, index = 0) {
    const [group, field] = key.split('.');
    if(group==='basic'&&Object.hasOwn(identityAliases,field))return identityValue(profile,key);
    if (key === 'basic.birthMonth') return profile.basic.birthMonth || (profile.basic.birthDate || '').slice(0, 7);
    if (key === 'basic.birthDate') return profile.basic.birthDate || profile.basic.birthMonth || '';
    return String((group === 'basic' ? profile.basic?.[field] : profile[group]?.[index]?.[field]) ?? '');
  }
  function questionText(value){
    return labelText(value).replace(/[（(](?:如有|如适用|选填|可选|optional)[）)]/gi,'')
      .replace(/^(?:请问|请(?:简要)?(?:说明|介绍|告知))\s*/,'')
      .replace(/^(?:您|你|本人|个人)(?:的)?\s*/,'')
      .replace(/(?:是什么|为多少|是多少)\s*$/,'').trim();
  }
  const questionPatterns={
    maritalStatus:/^(?:婚否|婚姻(?:状况|状态|情况)|是否(?:已婚|结婚|未婚)|maritalstatus|marriagestatus)$/,
    patentName:/^(?:专利(?:的)?(?:名称|名|题目|标题)|发明名称|patent(?:name|title))$/,
    patentNumber:/^(?:专利(?:的)?(?:号|号码|编号)|patent(?:number|no))$/,
    patentApplicationNumber:/^(?:(?:专利)?申请(?:号|号码|编号)|patentapplication(?:number|no))$/,
    patentPublicationNumber:/^(?:(?:专利)?(?:公开|公布)(?:号|号码|编号)|patentpublication(?:number|no))$/,
    paperTitle:/^(?:论文(?:名称|题目|标题)|papertitle|publicationtitle)$/,
    height:/^(?:身高|height)(?:cm|厘米)?$/,
    weight:/^(?:体重|weight)(?:kg|公斤|千克)?$/,
    householdPlace:/^(?:户籍(?:所在地|地|所在城市)|户口所在地|householdregistration(?:location|city))$/,
    homeAddress:/^(?:家庭(?:所在地|住址|地址)|homeaddress)$/,
    recruitmentSource:/^(?:招聘(?:信息)?(?:来源|渠道)|(?:您|你)?从(?:以下)?哪个渠道了解到本公司的招聘信息|通过什么渠道了解到(?:本公司|本次招聘)|如何获知(?:本公司|本次)招聘信息|recruitmentsource|applicationsource)$/,
    internshipDays:/^(?:每周(?:可|可以|能|能够)?(?:实习|到岗|出勤)(?:天数|几天)|每星期可实习天数|weeklyinternshipdays)$/,
    internshipMonths:/^(?:可(?:实习|连续实习)(?:时长|月数|几个月)|实习持续月数|internshipdurationmonths)$/,
    availableDate:/^(?:最早(?:可)?(?:到岗|入职)(?:时间|日期)|(?:预计|可)(?:到岗|入职)(?:时间|日期)|availabilitydate|availablestartdate)$/,
    expectedSalary:/^(?:(?:期望|期待|预期)(?:薪资|薪酬|工资)|expectedsalary)$/,
    currentSalary:/^(?:(?:目前|当前|现有)(?:薪资|薪酬|工资)|currentsalary)$/,
    workYears:/^(?:正式工作年限|工作年限|工作经验年数|yearsofworkexperience)$/,
    hobbies:/^(?:兴趣爱好|个人爱好|业余爱好|hobbies|interests)$/,
    relocation:/^(?:是否(?:愿意|接受|可以)(?:异地工作|异地调动|工作地点调动)|愿否接受异地工作|willingtorelocate)$/,
    travel:/^(?:是否(?:愿意|接受|可以)(?:出差|经常出差)|能否接受出差|willingtotravel)$/
  };
  function questionMeaning(label){
    const clean=questionText(label),n=normalize(clean);
    if(!n||manualOnly(clean))return '';
    const basic=fieldKey(clean).key;if(basic?.startsWith('basic.'))return basic;
    const hits=Object.entries(questionPatterns).filter(([,pattern])=>pattern.test(n));
    if(hits.length===1)return 'question.'+hits[0][0];
    const parts=clean.split(/[\/|｜、&＆()（）]/).map(x=>x.trim()).filter(Boolean);
    if(!hits.length&&parts.length>1){const keys=parts.map(questionMeaning);if(keys.every(Boolean)&&new Set(keys).size===1)return keys[0];}
    return '';
  }
  function questionNames(row){return [row.label,...(Array.isArray(row.aliases)?row.aliases:[])].filter(n=>typeof n==='string'&&n.trim());}
  function questionNameConflict(row){return new Set(questionNames(row).map(questionMeaning).filter(Boolean)).size>1;}
  function questionRelation(row,label){
    if(!row||!normalize(label)||manualOnly(label)||manualOnly(row.label)||questionNameConflict(row))return '';
    const target=normalize(questionText(label)),meaning=questionMeaning(label);
    if(questionNames(row).some(n=>normalize(questionText(n))===target))return normalize(row.label)===normalize(label)?'exact':'alias';
    return meaning&&questionNames(row).some(n=>questionMeaning(n)===meaning)?'equivalent':'';
  }
  function maritalAnswer(label,value){
    const n=normalize(questionText(label)),v=normalize(value);
    if(/^(?:婚否|是否(?:已婚|结婚|未婚))$/.test(n)){
      const yes=/^(?:是|yes|true|1)$/.test(v),no=/^(?:否|no|false|0)$/.test(v);
      if(yes||no)return (yes!==/未婚/.test(n))?'已婚':'未婚';
    }
    if(/^(?:未婚|未结婚|unmarried|single)$/.test(v))return '未婚';
    if(/^(?:已婚|已结婚|married)$/.test(v))return '已婚';
    return value.trim();
  }
  function customMatch(profile,label){
    const meaning=questionMeaning(label);
    if(manualOnly(label))return {value:'',recognized:false,indices:[]};
    const candidates=(profile.custom||[]).map((row,index)=>({row,index})).filter(({row})=>questionNames(row).some(n=>normalize(questionText(n))===normalize(questionText(label))||(meaning&&questionMeaning(n)===meaning)));
    if(candidates.some(({row})=>questionNameConflict(row)))return {value:'',recognized:true,indices:candidates.map(x=>x.index),conflict:true,meaning,reason:'其他叫法对应了不同资料项，请先检查问题标题和其他叫法'};
    const matches=(profile.custom||[]).map((row,index)=>({row,index,match:questionRelation(row,label)})).filter(x=>x.match);
    const filled=matches.filter(x=>typeof x.row.value==='string'&&x.row.value.trim());
    const answers=filled.map(x=>meaning==='question.maritalStatus'?maritalAnswer(x.row.label,x.row.value):x.row.value.trim());
    const unique=[...new Set(answers)];
    const base={recognized:!!meaning||!!matches.length,indices:matches.map(x=>x.index),meaning};
    if(unique.length>1)return {...base,value:'',conflict:true,reason:'同义问题保存了不同答案，请先确认要使用哪一条'};
    if(!unique.length)return {...base,value:'',reason:base.recognized?'已识别问题含义，请补充对应答案':''};
    let value=unique[0];
    if(meaning==='question.maritalStatus'&&/^是否(?:已婚|结婚|未婚)$/.test(normalize(questionText(label)))){
      if(!['已婚','未婚'].includes(value))return {...base,value:'',reason:'婚姻状态无法唯一对应这个是否问题，请确认'};
      value=(value==='未婚')===/未婚/.test(normalize(questionText(label)))?'是':'否';
    }
    const source=filled.find(x=>x.match==='exact')||filled[0];
    return {...base,value,index:source.index,match:source.match,source:'自定义问答 · '+source.row.label+(source.match==='exact'?'':source.match==='alias'?' · 其他叫法匹配':' · 同义匹配')};
  }
  function customValue(profile,label){return customMatch(profile,label).value;}
  function recordCustomMatch(profile,kind,index,label){
    const empty={value:'',recognized:false,indices:[]};
    if(!['educations','experiences','projects'].includes(kind)||!Number.isInteger(index)||index<0||manualOnly(label))return empty;
    const fields=profile[kind]?.[index]?.customFields||[],target=normalize(questionText(label));if(!target)return empty;
    const meaning=name=>fieldKey(questionText(name),kind).key||questionMeaning(name),targetMeaning=meaning(label);
    const candidates=fields.map((row,index)=>({row,index,names:questionNames(row)})).filter(({row,names})=>!manualOnly(row.label)&&names.some(name=>normalize(questionText(name))===target||targetMeaning&&meaning(name)===targetMeaning));
    if(!candidates.length)return empty;
    const base={recognized:true,indices:candidates.map(c=>c.index),fieldId:candidates[0].row.id};
    if(candidates.some(c=>new Set(c.names.map(meaning).filter(Boolean)).size>1))return {...base,value:'',conflict:true,reason:'这段经历的字段名称和其他叫法对应不同含义，请先核对'};
    const filled=candidates.filter(c=>typeof c.row.value==='string'&&c.row.value.trim()),first=filled[0]||candidates[0];
    const conflict=new Set(filled.map(c=>c.row.value.trim())).size>1;
    return {...base,index:first.index,fieldId:first.row.id,value:filled.length?first.row.value.trim():'',conflict,
      reason:filled.length?'':'这段经历尚未填写此自定义字段',
      reviewNote:conflict?'这段经历的同名字段有不同内容，已按保存顺序使用第一项，请核对。':'',
      source:'自定义字段 · '+first.row.label};
  }
  const sameLabel = (label,names) => !!normalize(label) && names.some(x=>normalize(x)===normalize(label));
  function moduleContexts(profile,title) {
    const clean=String(title||'').trim().replace(/\s*[（(]\d+[）)]\s*$/,'').replace(/\s+第?\d+\s*(?:条|项|段)?\s*$/,'');
    return (profile.modules||[]).filter(m=>sameLabel(title,[m.name,...m.aliases])||sameLabel(clean,[m.name,...m.aliases]));
  }
  function moduleFields(module,label) {return (module.fields||[]).filter(f=>sameLabel(label,[f.label,...f.aliases]));}
  function moduleMappings(profile) {
    const values=[];
    for(const m of profile.modules||[])m.entries.forEach((entry,index)=>m.fields.forEach(f=>{
      const value=entry.values[f.id];if(value)values.push({key:'modules',moduleId:m.id,fieldId:f.id,index,value,label:(m.name||'未命名模块')+' · 第 '+(index+1)+' 条 · '+f.label});
    }));
    return values;
  }
  function unscopedModuleField(profile,label) {
    if(/^(名称|姓名|内容|描述|说明|时间|日期|开始时间|结束时间|等级|角色|职位|学校|name|title|date|role|description|level)$/i.test(normalize(label)))return null;
    const matches=(profile.modules||[]).flatMap(m=>moduleFields(m,label).map(f=>({module:m,field:f})));
    return matches.length===1&&matches[0].module.entries.length===1?matches[0]:null;
  }
  function importText(raw) {
    const result = {};
    const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    const phone = raw.match(/(?<!\d)1[3-9]\d{9}(?!\d)/g);
    if (new Set(email || []).size === 1) result.email = email[0];
    if (new Set(phone || []).size === 1) result.phone = phone[0];
    const name = raw.match(/(?:^|\n)\s*(?:姓名|Name)\s*[:：]\s*([^\n\r]{2,40})/i);
    if (name) result.name = name[1].trim();
    return result;
  }
  globalThis.QTMatch = { normalize, labelText, sectionKind, educationRank, educationOrder, fieldKey, chooseOption, optionScore, isFullDate, resolve, customValue, customMatch, recordCustomMatch, questionText, questionMeaning, questionRelation, emergencyKey, importText, sensitive, manualOnly, identityKey, identityValue, moduleContexts, moduleFields, moduleMappings, unscopedModuleField, experienceType, sectionExperienceType };
  if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.QTMatch;
})();
