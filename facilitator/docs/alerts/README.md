# X402 Facilitator Alert Rules

This directory contains alert rule configurations and documentation for X402 Facilitator monitoring.

## Files

- `prometheus-alerts.yml` - Prometheus alert rules configuration (YAML format)
- `grafana-notification-policy-guide.md` - Guide for configuring Grafana notification policies
- `README.md` - This file

## Alert Rules Overview

The alert rules are defined in `prometheus-alerts.yml` and include the following alerts:

### 1. HighSettlementErrorRate
- **Severity**: Warning
- **Condition**: Settlement error rate exceeds 1%
- **Duration**: 5 minutes
- **Description**: Triggers when settlement error rate is consistently above 1%, indicating potential service issues or network problems

### 2. LowSettlementSuccessRate
- **Severity**: Critical
- **Condition**: Settlement success rate falls below 99%
- **Duration**: 5 minutes
- **Description**: Triggers when settlement success rate drops below the 99% target, requiring immediate attention

### 3. QueueOverload
- **Severity**: Warning
- **Condition**: Account queue depth reaches maximum (10)
- **Duration**: 2 minutes
- **Description**: Triggers when queue depth reaches the limit, which may cause request rejections

### 4. LowProfitability
- **Severity**: Warning
- **Condition**: Unprofitable settlements exceed 5%
- **Duration**: 1 hour
- **Description**: Triggers when the percentage of unprofitable settlements is too high, indicating potential gas price issues or insufficient facilitator fees

### 5. HighSettlementLatency
- **Severity**: Warning
- **Condition**: P99 settlement latency exceeds 30 seconds
- **Duration**: 10 minutes
- **Description**: Triggers when settlement latency is too high, potentially affecting user experience

### 6. HighQueueRejectionRate
- **Severity**: Warning
- **Condition**: Queue rejection rate exceeds 1 per minute
- **Duration**: 5 minutes
- **Description**: Triggers when queue rejection rate is too high, suggesting the need to increase account pool size or queue limits

### 7. HighVerificationErrorRate
- **Severity**: Warning
- **Condition**: Verification error rate exceeds 5%
- **Duration**: 5 minutes
- **Description**: Triggers when verification error rate is too high, indicating invalid payment requests or network issues

### 8. NoSettlements
- **Severity**: Warning
- **Condition**: No settlement requests in the last 10 minutes
- **Duration**: 10 minutes
- **Description**: Triggers when no settlements occur for an extended period, potentially indicating service issues or no traffic

### 9. HighGasCost
- **Severity**: Warning
- **Condition**: Average gas cost exceeds $10 USD
- **Duration**: 15 minutes
- **Description**: Triggers when gas costs are too high, indicating network congestion or inefficient hooks

### 10. NegativeProfit
- **Severity**: Critical
- **Condition**: Total profit is negative
- **Duration**: 1 hour
- **Description**: Triggers when total profit is negative, indicating the facilitator is losing money and requires immediate review of gas costs and facilitator fees

## Alert Labels

All alerts include the following labels:

- `severity`: Alert severity level (`warning` or `critical`)
- `component`: Component name (`facilitator`)
- `alert_type`: Alert type (`error_rate`, `success_rate`, `queue_depth`, `profitability`, `latency`, `queue_rejection`, `verification_error`, `availability`, `gas_cost`)

These labels can be used for alert routing and notification configuration.

## Usage

### Prometheus Configuration

Add the alert rules file to your `prometheus.yml`:

```yaml
rule_files:
  - "docs/alerts/prometheus-alerts.yml"  # Adjust path as needed
```

### Grafana Alerting

If using Grafana Alerting:

1. Create alert rules in Grafana UI (refer to Grafana documentation)
2. Configure notification policies using label matchers (refer to [`grafana-notification-policy-guide.md`](./grafana-notification-policy-guide.md))

The notification policy guide explains how to configure label matchers to route alerts to different notification channels based on the alert labels defined in `prometheus-alerts.yml`.

## Related Documentation

- [Monitoring Guide](../monitoring.md) - Complete monitoring documentation
- [Grafana Notification Policy Guide](./grafana-notification-policy-guide.md) - Guide for configuring notification policies in Grafana
- [Prometheus Alerting Rules Documentation](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)
