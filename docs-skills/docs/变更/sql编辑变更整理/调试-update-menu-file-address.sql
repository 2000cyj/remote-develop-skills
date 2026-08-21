-- ============================================================================
-- 出纳子应用页面目录迁移 - 菜单路由 menu_file_address 修正
-- 生成日期: 2026-08-01
-- 迁移依据: docs/basics-develop-skills-vue/basics-list-page-directory-vue
-- 涉及迁移模块:
--   seal    : components/addOrEdit.vue  → addOrEdit/addOrEdit.vue
--   company : components/{add,editOrCheck}.vue → addOrEdit/{add,editOrCheck}.vue
--   businessScope: 仅 config/type 目录迁移, index.vue 路径未变 → 无需更新
--   bankCard / employee / store / fileExpiration: 路径未变 → 无需更新
-- 关联文件(供参考): 调试-create1.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) 唯一性预检: menu_id 是否有重复
--    若此查询返回空集 = 无重复, menu_id 可用作 WHERE 唯一检索键
--    （调试-create1.sql 内 23 个 menu_id 已逐一核对, 均唯一）
-- ----------------------------------------------------------------------------
SELECT menu_id, COUNT(*) AS cnt
FROM `bi_sys`.`sys_menu_routing`
GROUP BY menu_id
HAVING COUNT(*) > 1;

-- ----------------------------------------------------------------------------
-- 1) 命中预检: 确认待更新的旧地址当前仍存在（应命中 6 行）
-- ----------------------------------------------------------------------------
SELECT id, menu_id, menu_nom, menu_route, menu_file_address
FROM `bi_sys`.`sys_menu_routing`
WHERE menu_id IN ('gsglInsert', 'gsglChange', 'gsglCheck', 'yzglInsert', 'yzglChange', 'yzglCheck')
ORDER BY id;

-- ============================================================================
-- 2) 正式更新
--    检索键: menu_id（唯一）
--    附加条件 menu_file_address = 旧地址 作兜底保护:
--      旧地址已被其他改动覆盖时不生效, 避免误改
-- ============================================================================

-- 公司管理 - 新增:  components/add.vue → addOrEdit/add.vue
UPDATE `bi_sys`.`sys_menu_routing`
SET menu_file_address = '/Cashier/company/addOrEdit/add.vue'
WHERE menu_id = 'gsglInsert'
  AND menu_file_address = '/Cashier/company/components/add.vue';

-- 公司管理 - 修改:  components/editOrCheck.vue → addOrEdit/editOrCheck.vue
UPDATE `bi_sys`.`sys_menu_routing`
SET menu_file_address = '/Cashier/company/addOrEdit/editOrCheck.vue'
WHERE menu_id = 'gsglChange'
  AND menu_file_address = '/Cashier/company/components/editOrCheck.vue';

-- 公司管理 - 详情:  components/editOrCheck.vue → addOrEdit/editOrCheck.vue
UPDATE `bi_sys`.`sys_menu_routing`
SET menu_file_address = '/Cashier/company/addOrEdit/editOrCheck.vue'
WHERE menu_id = 'gsglCheck'
  AND menu_file_address = '/Cashier/company/components/editOrCheck.vue';

-- 印章管理 - 新增:  components/addOrEdit.vue → addOrEdit/addOrEdit.vue
UPDATE `bi_sys`.`sys_menu_routing`
SET menu_file_address = '/Cashier/seal/addOrEdit/addOrEdit.vue'
WHERE menu_id = 'yzglInsert'
  AND menu_file_address = '/Cashier/seal/components/addOrEdit.vue';

-- 印章管理 - 修改
UPDATE `bi_sys`.`sys_menu_routing`
SET menu_file_address = '/Cashier/seal/addOrEdit/addOrEdit.vue'
WHERE menu_id = 'yzglChange'
  AND menu_file_address = '/Cashier/seal/components/addOrEdit.vue';

-- 印章管理 - 详情
UPDATE `bi_sys`.`sys_menu_routing`
SET menu_file_address = '/Cashier/seal/addOrEdit/addOrEdit.vue'
WHERE menu_id = 'yzglCheck'
  AND menu_file_address = '/Cashier/seal/components/addOrEdit.vue';

-- ============================================================================
-- 3) 更新后校验: 应看到 6 行全部指向 addOrEdit 新路径
-- ============================================================================
SELECT id, menu_id, menu_nom, menu_route, menu_file_address
FROM `bi_sys`.`sys_menu_routing`
WHERE menu_id IN ('gsglInsert', 'gsglChange', 'gsglCheck', 'yzglInsert', 'yzglChange', 'yzglCheck')
ORDER BY id;
