-- cashier 微应用按钮权限菜单数据（由 docs/权限/package.json 生成）
-- 表：bi_sys.sys_menu_permission；if_public_view=0 私有，tenant_id=1；Change 类 menu_name 沿用模板写作「修改」

-- 银行卡管理（bankCard，路由 /yhkgl）
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('yhkgl', 'yhkgl', '银行卡管理', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('yhkgl', 'yhkglInsert', '银行卡管理 - 新增', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('yhkgl', 'yhkglCheck', '银行卡管理 - 查看', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('yhkgl', 'yhkglChange', '银行卡管理 - 修改', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('yhkgl', 'yhkglDelete', '银行卡管理 - 删除', 0, 1);

-- 人员管理（employee，路由 /ryxx）
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('ryxx', 'ryxx', '人员管理', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('ryxx', 'ryxxInsert', '人员管理 - 新增', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('ryxx', 'ryxxCheck', '人员管理 - 查看', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('ryxx', 'ryxxChange', '人员管理 - 修改', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('ryxx', 'ryxxDelete', '人员管理 - 删除', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('ryxx', 'ryxxIdCard', '人员管理 - 查看身份证完整号', 0, 1);

-- 印章管理（seal，路由 /yzgl）
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('yzgl', 'yzgl', '印章管理', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('yzgl', 'yzglInsert', '印章管理 - 新增', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('yzgl', 'yzglCheck', '印章管理 - 查看', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('yzgl', 'yzglChange', '印章管理 - 修改', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('yzgl', 'yzglDelete', '印章管理 - 删除', 0, 1);

-- 店铺管理（store，路由 /dpgl）
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('dpgl', 'dpgl', '店铺管理', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('dpgl', 'dpglInsert', '店铺管理 - 新增', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('dpgl', 'dpglCheck', '店铺管理 - 查看', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('dpgl', 'dpglChange', '店铺管理 - 修改', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('dpgl', 'dpglDelete', '店铺管理 - 删除', 0, 1);

-- 公司管理（company，路由 /gsgl）
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('gsgl', 'gsgl', '公司管理', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('gsgl', 'gsglInsert', '公司管理 - 新增', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('gsgl', 'gsglChange', '公司管理 - 修改', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('gsgl', 'gsglCheck', '公司管理 - 查看', 1, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('gsgl', 'gsglDelete', '公司管理 - 删除', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('gsgl', 'gsglCheckBasic', '公司管理 - 查看（基础信息）', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('gsgl', 'gsglCheckCapital', '公司管理 - 查看（注册资本信息）', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('gsgl', 'gsglCheckBankcard', '公司管理 - 查看（银行卡信息）', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('gsgl', 'gsglCheckBusiness', '公司管理 - 查看（工商信息）', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('gsgl', 'gsglCheckTax', '公司管理 - 查看（税务信息）', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('gsgl', 'gsglCheckCancellation', '公司管理 - 查看（注销信息）', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('gsgl', 'gsglCheckSeal', '公司管理 - 查看（印章信息）', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('gsgl', 'gsglCheckFiles', '公司管理 - 查看（文件资料）', 0, 1);

-- 经营范围管理（经营类型与经营范围）（businessScope，路由 (待定)）
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('jyfwgl', 'jyfwgl', '经营范围管理', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('jyfwgl', 'jyfwglInsert', '经营范围管理 - 新增', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('jyfwgl', 'jyfwglChange', '经营范围管理 - 修改', 0, 1);
INSERT INTO `bi_sys`.`sys_menu_permission` (`two_level_id`, `menu_id`, `menu_name`, `if_public_view`, `tenant_id`) VALUES ('jyfwgl', 'jyfwglDelete', '经营范围管理 - 删除', 0, 1);
