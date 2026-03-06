## 一、规范总则

### 1.1 核心目标

* 区分**业务异常**与**系统异常**，统一异常定义、编码、抛出、处理逻辑，适配供应链计划核心业务大类（DP、SOP、MPS、MRP、MDS、SCH）以及系统异常SYS；

* 异常信息支持**国际化配置**，具备精准性、可识别性、可处理性，兼顾多语言场景与问题排查效率；

* 异常描述支持动态占位符填充，贴合供应链计划业务场景（需求计划、库存、生产排程等）的参数化提示需求。

### 1.2 适用范围

本规范适用于供应链计划系统所有 Java 开发模块（DP/SOP/MPS/MRP/MDS/SCH），覆盖前端交互、业务逻辑、数据访问全层级，所有开发人员需严格遵循。

### 1.3 核心原则

## 二、异常分类与定义规范

### 2.1 异常分类

### 2.2 业务大类编码映射

明确供应链计划核心业务大类的编码前缀，作为异常编码的核心组成：

### 2.3 异常枚举设计规范

2.3.1 枚举核心结构（适配国际化 + 占位符）

```java
import java.text.MessageFormat;

/**
 * 供应链计划系统业务异常枚举（考虑国际化+占位符）
 * 编码规则：业务大类前缀 + 异常类型 + 3位序号
  异常描述后续会通过统一的国际化导出导入到国际化配置文件中
 */
public enum BusinessErrorEnum implements CommonEnum{
    // --------------------- 需求计划（DP） ---------------------
    DP_DATE_ERROR("DP001","异常默认描述"),
    DP_QTY_EXCEED("DP002", "异常默认描述"),
    
    
    // --------------------- 产销协同计划（SOP） ---------------------
    SOP_DATA_EMPTY("SOP001", "异常默认描述"),
    
    
    // --------------------- 主生产计划（MPS） ---------------------
    MPS_RESOURCE_LIMIT("MPS001", "异常默认描述"),
    
    
    // --------------------- 物料需求计划（MRP） ---------------------
    MRP_CALC_FAILED("MRP001", "异常默认描述"),
    
    
    // --------------------- 主需求计划（MDS） ---------------------
    MDS_MATERIAL_NOT_EXIST("MDS001", "异常默认描述"),
    
    
    // --------------------- 生产排程（SCH） ---------------------
    SCH_TIME_CONFLICT("SCH001", "异常默认描述"),
    
    
    // --------------------- 系统通用 ---------------------
    SYSTEM_XXX("SYS001", "异常默认描述");
    
    private final String code;  // 异常编码（关联国际化配置key）
    private final String desc;  // 异常描述            

    // 构造方法
    BusinessErrorEnum(String code, String desc) {
        this.code = code;
        this.desc= desc;
    }

    /**
     * 获取国际化异常描述（支持占位符）
     * @param args 占位符参数
     * @return 格式化后的国际化描述
     */
    public String getI18nErrordesc(Object... args) {
        // 从国际化配置加载模板：I18nUtil.getString(异常编码)
        String descTemplate = I18nUtil.getString(this.code);
        return args == null || args.length == 0 ? descTemplate :                      MessageFormat.format(descTemplate, args);
    }

    /**
     * 获取国际化处理建议
     * @return 处理建议
     */
    public String getI18nStr() {
        return I18nUtil.getString(this.code);
    }

    // getter方法
    public String getCode() {
        return code;
    }


    public String getDesc() {
        return desc;
    }
}
```

### 2.3.2 国际化配置文件规范

&#x20;系统根据异常枚举信息自动扫描生成国际化配置文件内容**文件命名**：`messages_zh_CN.properties`（中文）、`messages_en_US.properties`（英文）

### 2.3.3 异常编码规范

编码格式：`业务大类前缀 + 异常类型 + 3位序号`，具体规则：

### 2.4 自定义异常类设计规范

产品中已经定义了统一异常类 BusinessException



## 三、异常抛出规范

### 3.1 抛出层级

* 业务异常**仅允许在 Service 层抛出**，禁止在 Controller、DAO 层抛出；

* DAO 层异常（如 SQL 异常）需在 Service 层捕获，转换为对应业务异常（关联国际化编码）或系统异常。

### 3.2 抛出规则

#### 3.2.1 无占位符异常

java

运行

```java
// 场景：SOP数据为空
throw new BusinessException(BusinessErrorEnum.SOP_DATA_EMPTY.getDesc());
```

#### 3.2.2 带占位符异常

java

运行

```java
// 场景：MRP计算失败（物料依赖异常）
String materialCode = "M001";
//materialCode 占位符的值
throw new BusinessException(BusinessErrorEnum.MDS_MATERIAL_NOT_EXIST.getDesc(), materialCode);
```

### 3.3 禁止行为

* 禁止直接抛出`RuntimeException`/`Exception`替代业务异常；

* 禁止硬编码异常描述（必须通过枚举 + 国际化配置）；

* 禁止在循环 / 高频调用中频繁抛出异常（异常仅用于异常场景，不用于业务逻辑判断）；

* 禁止占位符参数数量与国际化模板不匹配（如模板 {0}{1} 仅传 1 个参数）。

