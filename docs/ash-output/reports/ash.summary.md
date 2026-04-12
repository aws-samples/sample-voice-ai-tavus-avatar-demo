# ASH Security Scan Report

- **Report generated**: 2026-04-09T22:53:04+00:00
- **Time since scan**: 9 minutes

## Scan Metadata

- **Project**: ASH
- **Scan executed**: 2026-04-09T22:43:50+00:00
- **ASH version**: 3.2.5

## Summary

### Scanner Results

The table below shows findings by scanner, with status based on severity thresholds and dependencies:

- **Severity levels**:
  - **Suppressed (S)**: Findings that have been explicitly suppressed and don't affect scanner status
  - **Critical (C)**: Highest severity findings that require immediate attention
  - **High (H)**: Serious findings that should be addressed soon
  - **Medium (M)**: Moderate risk findings
  - **Low (L)**: Lower risk findings
  - **Info (I)**: Informational findings with minimal risk
- **Duration (Time)**: Time taken by the scanner to complete its execution
- **Actionable**: Number of findings at or above the threshold severity level that require attention
- **Result**:
  - **PASSED** = No findings at or above threshold
  - **FAILED** = Findings at or above threshold
  - **MISSING** = Required dependencies not available
  - **SKIPPED** = Scanner explicitly disabled
  - **ERROR** = Scanner execution error
- **Threshold**: The minimum severity level that will cause a scanner to fail
  - Thresholds: ALL, LOW, MEDIUM, HIGH, CRITICAL
  - Source: Values in parentheses indicate where the threshold is set:
    - `global` (global_settings section in the ASH_CONFIG used)
    - `config` (scanner config section in the ASH_CONFIG used)
    - `scanner` (default configuration in the plugin, if explicitly set)
- **Statistics calculation**:
  - All statistics are calculated from the final aggregated SARIF report
  - Suppressed findings are counted separately and do not contribute to actionable findings
  - Scanner status is determined by comparing actionable findings to the threshold

| Scanner | Suppressed | Critical | High | Medium | Low | Info | Actionable | Result | Threshold |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| bandit | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ERROR | MEDIUM (global) |
| cdk-nag | 0 | 13 | 0 | 2 | 0 | 9 | 15 | FAILED | MEDIUM (global) |
| cfn-nag | 0 | 2 | 0 | 19 | 0 | 0 | 21 | FAILED | MEDIUM (global) |
| checkov | 0 | 60 | 0 | 0 | 0 | 0 | 60 | FAILED | MEDIUM (global) |
| detect-secrets | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PASSED | MEDIUM (global) |
| grype | 0 | 34 | 0 | 33 | 7 | 0 | 67 | FAILED | MEDIUM (global) |
| npm-audit | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PASSED | MEDIUM (global) |
| opengrep | 0 | 1 | 0 | 0 | 0 | 0 | 1 | FAILED | MEDIUM (global) |
| semgrep | 0 | 1 | 0 | 0 | 0 | 0 | 1 | FAILED | MEDIUM (global) |
| syft | 0 | 0 | 0 | 0 | 0 | 0 | 0 | PASSED | MEDIUM (global) |

### Top 10 Hotspots

Files with the highest number of security findings:

| Finding Count | File Location |
| ---: | --- |
| 56 | tavus-pipecat-example/infra/template.yaml |
| 46 | tavus-pipecat-example/frontend/package-lock.json |
| 11 | tavus-pipecat-example/env/lib/python3.13/site-packages/cv2/.dylibs/libavcodec.61.19.101.dylib |
| 6 | tavus-pipecat-example/env/lib/python3.13/site-packages/botocore/data/dynamodb/2012-08-10/paginators-1.json |
| 4 | tavus-pipecat-example/Dockerfile |
| 4 | tavus-pipecat-example/env/lib/python3.13/site-packages/botocore/data/s3/2006-03-01/paginators-1.json |
| 4 | tavus-avatar/package-lock.json |
| 3 | tavus-pipecat-example/env/lib/python3.13/site-packages/botocore/data/iam/2010-05-08/examples-1.json |
| 3 | tavus-pipecat-example/env/lib/python3.13/site-packages/botocore/data/rds/2014-10-31/examples-1.json |
| 3 | tavus-pipecat-example/env/lib/python3.13/site-packages/av/.dylibs/libavcodec.62.11.100.dylib |

<h2>Detailed Findings</h2>

<details>
<summary>Show 20 of 165 actionable findings</summary>

### Finding 1: CFN_NAG_W10

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W10
- **Location**: tavus-pipecat-example/infra/template.yaml:289

**Description**:
CloudFront Distribution should enable access logging

---

### Finding 2: CFN_NAG_W70

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W70
- **Location**: tavus-pipecat-example/infra/template.yaml:289

**Description**:
Cloudfront should use minimum protocol version TLS 1.2

---

### Finding 3: CFN_NAG_W52

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W52
- **Location**: tavus-pipecat-example/infra/template.yaml:118

**Description**:
Elastic Load Balancer V2 should have access logging enabled

---

### Finding 4: CFN_NAG_W56

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W56
- **Location**: tavus-pipecat-example/infra/template.yaml:147

**Description**:
Elastic Load Balancer V2 Listener Protocol should use HTTPS for ALBs

---

### Finding 5: CFN_NAG_W11

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W11
- **Location**: tavus-pipecat-example/infra/template.yaml:63

**Description**:
IAM role should not allow * resource on its permissions policy

---

### Finding 6: CFN_NAG_W84

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W84
- **Location**: tavus-pipecat-example/infra/template.yaml:163

**Description**:
CloudWatchLogs LogGroup should specify a KMS Key Id to encrypt the log data

---

### Finding 7: CFN_NAG_W28

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W28
- **Location**: tavus-pipecat-example/infra/template.yaml:28

**Description**:
Resource found with an explicit name, this disallows updates that require replacement of this resource

---

### Finding 8: CFN_NAG_W28

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W28
- **Location**: tavus-pipecat-example/infra/template.yaml:118

**Description**:
Resource found with an explicit name, this disallows updates that require replacement of this resource

---

### Finding 9: CFN_NAG_W28

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W28
- **Location**: tavus-pipecat-example/infra/template.yaml:39

**Description**:
Resource found with an explicit name, this disallows updates that require replacement of this resource

---

### Finding 10: CFN_NAG_W28

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W28
- **Location**: tavus-pipecat-example/infra/template.yaml:63

**Description**:
Resource found with an explicit name, this disallows updates that require replacement of this resource

---

### Finding 11: CFN_NAG_W35

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W35
- **Location**: tavus-pipecat-example/infra/template.yaml:257

**Description**:
S3 Bucket should have access logging configured

---

### Finding 12: CFN_NAG_W41

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W41
- **Location**: tavus-pipecat-example/infra/template.yaml:257

**Description**:
S3 Bucket should have encryption option set

---

### Finding 13: CFN_NAG_W9

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W9
- **Location**: tavus-pipecat-example/infra/template.yaml:86

**Description**:
Security Groups found with ingress cidr that is not /32

---

### Finding 14: CFN_NAG_W9

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W9
- **Location**: tavus-pipecat-example/infra/template.yaml:101

**Description**:
Security Groups found with ingress cidr that is not /32

---

### Finding 15: CFN_NAG_W2

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W2
- **Location**: tavus-pipecat-example/infra/template.yaml:86

**Description**:
Security Groups found with cidr open to world on ingress.  This should never be true on instance.  Permissible on ELB

---

### Finding 16: CFN_NAG_W2

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W2
- **Location**: tavus-pipecat-example/infra/template.yaml:101

**Description**:
Security Groups found with cidr open to world on ingress.  This should never be true on instance.  Permissible on ELB

---

### Finding 17: CFN_NAG_W27

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W27
- **Location**: tavus-pipecat-example/infra/template.yaml:101

**Description**:
Security Groups found ingress with port range instead of just a single port

---

### Finding 18: CFN_NAG_F1000

- **Severity**: HIGH
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_F1000
- **Location**: tavus-pipecat-example/infra/template.yaml:86

**Description**:
Missing egress rule means all traffic is allowed outbound.  Make this explicit if it is desired configuration

---

### Finding 19: CFN_NAG_F1000

- **Severity**: HIGH
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_F1000
- **Location**: tavus-pipecat-example/infra/template.yaml:101

**Description**:
Missing egress rule means all traffic is allowed outbound.  Make this explicit if it is desired configuration

---

### Finding 20: CFN_NAG_W36

- **Severity**: MEDIUM
- **Scanner**: cfn-nag
- **Rule ID**: CFN_NAG_W36
- **Location**: tavus-pipecat-example/infra/template.yaml:86

**Description**:
Security group rules without a description obscure their purpose and may lead to bad practices in ensuring they only allow traffic from the ports and sources/destinations required.


> Note: Showing 20 of 165 total actionable findings. Configure `max_detailed_findings` to adjust this limit.

</details>

---

*Report generated by [Automated Security Helper (ASH)](https://github.com/awslabs/automated-security-helper) at 2026-04-09T22:53:04+00:00*