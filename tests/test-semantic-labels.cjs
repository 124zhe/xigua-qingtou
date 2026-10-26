const assert=require('node:assert/strict');
const M=require('../extension/matcher.js');
const groups={
 'experiences.company':['单位名称','公司全称','任职企业名称','所属机构全称','Employer / 公司名称','公司名称（必填）','＊ 公司全称（不超过 200 字） 0/200'],
 'experiences.role':['担任职位','所任职务','任职岗位名称','工作职位','Job title / 职位名称'],
 'experiences.department':['任职部门','实习部门','所属部门名称','所在部门','Department','部门'],
 'experiences.description':['主要职责与业绩','岗位职责及成果','工作内容与成果','职责与业绩','主要工作职责与成果','工作描述（限 5000 字）','Responsibilities / 工作职责','Duties and achievements'],
 'educations.school':['就读学校全称','毕业院校名称','University / 学校名称'],
 'educations.college':['就读院系','所属学院名称','Department','College name'],
 'educations.endDate':['毕业或预计毕业时间','预计毕业年月','预期毕业日期','预定毕业时间','Graduation date / 毕业日期','Date of graduation','Expected graduation date','Expected graduation month'],
 'educations.startDate':['Date of enrollment','Enrolment date','Admission date'],
 'educations.major':['最高学历专业','最高学历的专业名称'],
 'projects.description':['主要职责与业绩','项目内容与成果','项目工作内容及成果','Project description / 项目介绍'],
 'projects.name':['课题名称','项目全称'],
 'basic.phone':['本人手机号码','联系手机','Mobile number / 手机号','Telephone number','Mobile phone number'],
 'basic.website':['Portfolio URL','Personal website'],
 'basic.email':['电子邮箱地址','联系邮箱地址','Email address / 电子邮箱'],
 'basic.nationality':['国籍/地区','国籍／地区','国籍（地区）','国籍或地区','国籍（国家/地区）','国家/地区（国籍）','Nationality / Region','Nationality (Region)','Nationality or Region','Nationality / Country or Region','Country of citizenship','Country / Region of citizenship'],
 'basic.city':['现居住地','现居住城市','居住地','目前居住地','当前居住地','目前居住城市','当前居住城市','Current residence'],
 'basic.nativePlace':['籍贯'],
 'basic.studentOrigin':['生源地','生源地区','生源所在地','生源地（高考所在地）','Student origin'],
 'basic.emergencyName':['紧急情况联系人','紧急情况联系人姓名','紧急情况下联系人姓名','紧急情况联络人姓名','请填写紧急情况联系人姓名','紧急情况时联系人','紧急情况时联系人姓名','紧急情况时联络人姓名'],
 'basic.emergencyPhone':['紧急情况联系人电话','紧急情况联系人联系电话','紧急情况联系人手机号','紧急情况下联系人手机号码','紧急情况联系电话','紧急情况联络人电话','紧急情况时联系人电话','紧急情况时联系人手机号','紧急情况时联系电话'],
 'basic.emergencyRelation':['紧急情况联系人关系','与紧急情况联系人关系','与紧急情况联系人的关系','紧急情况联系人与本人关系','与紧急情况下联系人关系','紧急情况时联系人关系','与紧急情况时联系人的关系','紧急情况时联系人与本人关系']
};
let checks=0;
for(const [key,labels] of Object.entries(groups))for(const label of labels){const kind=key.startsWith('basic.')?'':key.split('.')[0];assert.equal(M.fieldKey(label,kind).key,key,label);checks++;}
for(const [label,kind] of [['公司注册地址','experiences'],['原单位联系电话','experiences'],['公司名称 / 职位名称','experiences'],['岗位名称及级别','experiences'],['部门职责','experiences'],['预计到岗时间','experiences'],['学院名称','experiences'],['任职部门','educations'],['单位名称','projects'],['项目名称','experiences'],['Department','']]){assert.equal(M.fieldKey(label,kind).key,null,label);checks++;}
for(const label of ['国家/地区','居住国家/地区','工作国家/地区','出生国家/地区','期望工作国家/地区','国籍证明材料','国籍变更情况','民族/地区','是否同意提供国籍/地区','现居住地证明','公司现居住地','籍贯/生源地','生源学校','高考所在地','高考地点','紧急情况联系人年龄','紧急情况时联系人年龄','家庭成员姓名','是否同意联系紧急情况联系人','是否同意联系紧急情况时联系人']){assert.equal(M.fieldKey(label).key,null,label);checks++;}
assert.equal(M.fieldKey('毕业院校所在国家/地区','educations').key,'educations.schoolRegion');checks++;
for(const label of groups['basic.city']){assert.equal(M.questionMeaning(label),M.fieldKey(label).key,label+' meaning agrees with field mapping');checks++;}
for(const [label,key] of [['姓名','basic.emergencyName'],['电话','basic.emergencyPhone'],['关系','basic.emergencyRelation']]){assert.equal(M.fieldKey(label,'emergency').key,key,label+' in emergency section');checks++;}
for(const label of ['国籍/地区','现居住地','生源地','身份证号码']){assert.equal(M.fieldKey(label,'emergency').key,null,label+' is not an applicant field in an emergency section');checks++;}
assert.equal(M.fieldKey('期望岗位','experiences').key,'basic.desiredRole');checks++;
for(const [title,kind] of [['工作／实习经历-3','experiences'],['work-experience','experiences'],['Education history','educations'],['项目经历-1','projects'],['工作经历与项目经历','']]){assert.equal(M.sectionKind(title),kind);checks++;}
console.log('PASS semantic labels:',checks,'assertions; equivalent labels, contexts and non-equivalent boundaries');
