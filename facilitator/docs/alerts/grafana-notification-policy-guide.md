# Grafana Notification Policy Configuration Guide

This guide explains how to configure notification policies in Grafana to route alerts to different notification channels based on alert labels.

## Alert Labels

According to the alert rules in `prometheus-alerts.yml`, all alerts include the following labels:

- `severity`: Alert severity level (`warning` or `critical`)
- `component`: Component name (`facilitator`)
- `alert_type`: Alert type (`error_rate`, `success_rate`, `queue_depth`, `profitability`, `latency`, `queue_rejection`, `verification_error`, `availability`, `gas_cost`)

## Notification Policy Configuration

When configuring notification policies in Grafana, you need to set **Label matchers** to route alerts.

### Configuration Steps

1. **Access Notification Policy Configuration**:

   - Log in to Grafana
   - Go to **Alerting** → **Notification policies** (Grafana 9.x+)
   - Or **Alerting** → **Notification channels** → **Edit** (Grafana 8.x)

2. **Create New Notification Policy**:
   - Click **New policy** or **Add policy**
   - Configure label matchers and notification channels

### Recommended Notification Policy Configurations

#### Policy 1: Critical Alerts (Highest Priority)

**Label matchers**:

```
severity = critical
```

**Contact point**: Select Alertmanager or directly configured critical notification channel

**Description**: Matches all Critical level alerts, including:

- Low Settlement Success Rate
- Negative Profit

**Configuration Example**:

- **Policy name**: `Critical Alerts`
- **Label matchers**: `severity = critical`
- **Contact point**: `Alertmanager` or `Critical Slack Channel`
- **Group by**: `alertname`, `component`
- **Group wait**: `5s`
- **Group interval**: `5s`
- **Repeat interval**: `4h`

#### Policy 2: Warning Alerts

**Label matchers**:

```
severity = warning
```

**Contact point**: Select Alertmanager or warning notification channel

**Description**: Matches all Warning level alerts

**Configuration Example**:

- **Policy name**: `Warning Alerts`
- **Label matchers**: `severity = warning`
- **Contact point**: `Alertmanager` or `Warning Slack Channel`
- **Group by**: `alertname`, `component`
- **Group wait**: `30s`
- **Group interval**: `5m`
- **Repeat interval**: `12h`

#### Policy 3: Profitability Alerts

**Label matchers**:

```
alert_type = profitability
```

**Contact point**: Select finance team notification channel

**Description**: Matches profitability-related alerts:

- Low Profitability
- Negative Profit

**Configuration Example**:

- **Policy name**: `Profitability Alerts`
- **Label matchers**: `alert_type = profitability`
- **Contact point**: `Finance Slack Channel` or `finance@yourdomain.com`
- **Group by**: `alertname`
- **Group wait**: `1m`
- **Group interval**: `10m`
- **Repeat interval**: `6h`

#### Policy 4: Queue Alerts

**Label matchers**:

```
alert_type = queue_depth
```

**Contact point**: Select operations team notification channel

**Description**: Matches queue-related alerts:

- Queue Overload
- High Queue Rejection Rate

**Configuration Example**:

- **Policy name**: `Queue Alerts`
- **Label matchers**: `alert_type = queue_depth`
- **Contact point**: `Operations Slack Channel`
- **Group by**: `alertname`
- **Group wait**: `30s`
- **Group interval**: `5m`
- **Repeat interval**: `2h`

#### Policy 5: Error Rate Alerts

**Label matchers**:

```
alert_type = error_rate
```

**Contact point**: Select error monitoring channel

**Description**: Matches error rate-related alerts:

- High Settlement Error Rate
- High Verification Error Rate

**Configuration Example**:

- **Policy name**: `Error Rate Alerts`
- **Label matchers**: `alert_type = error_rate`
- **Contact point**: `Error Monitoring Slack Channel`
- **Group by**: `alertname`
- **Group wait**: `1m`
- **Group interval**: `5m`
- **Repeat interval**: `4h`

#### Policy 6: Latency Alerts

**Label matchers**:

```
alert_type = latency
```

**Contact point**: Select performance monitoring channel

**Description**: Matches latency-related alerts:

- High Settlement Latency

**Configuration Example**:

- **Policy name**: `Latency Alerts`
- **Label matchers**: `alert_type = latency`
- **Contact point**: `Performance Slack Channel`
- **Group by**: `alertname`
- **Group wait**: `1m`
- **Group interval**: `5m`
- **Repeat interval**: `4h`

#### Policy 7: Availability Alerts

**Label matchers**:

```
alert_type = availability
```

**Contact point**: Select operations team notification channel

**Description**: Matches availability-related alerts:

- No Settlements

**Configuration Example**:

- **Policy name**: `Availability Alerts`
- **Label matchers**: `alert_type = availability`
- **Contact point**: `Operations Slack Channel`
- **Group by**: `alertname`
- **Group wait**: `1m`
- **Group interval**: `5m`
- **Repeat interval**: `2h`

#### Policy 8: Gas Cost Alerts

**Label matchers**:

```
alert_type = gas_cost
```

**Contact point**: Select finance or operations team notification channel

**Description**: Matches gas cost-related alerts:

- High Gas Cost

**Configuration Example**:

- **Policy name**: `Gas Cost Alerts`
- **Label matchers**: `alert_type = gas_cost`
- **Contact point**: `Finance Slack Channel`
- **Group by**: `alertname`
- **Group wait**: `1m`
- **Group interval**: `10m`
- **Repeat interval**: `6h`

## Label Matcher Syntax

Grafana supports the following matcher operators:

- `=`: Exact match
- `!=`: Not equal
- `=~`: Regex match
- `!~`: Regex not match

### Examples

```
# Exact match
severity = critical

# Not equal
severity != warning

# Regex match (matches all alert_type starting with error)
alert_type =~ error.*

# Multiple conditions (AND relationship)
severity = critical AND component = facilitator

# Multiple conditions (OR relationship requires creating multiple policies)
```

## Policy Priority

Grafana matches policies in order, and **the first matching policy will be used**. It's recommended to configure policies in the following order:

1. **Most specific policies first** (e.g., policies matching specific `alert_type`)
2. **General policies last** (e.g., policies matching all alerts by `severity`)

### Recommended Order

```
1. Profitability Alerts (alert_type = profitability)
2. Queue Alerts (alert_type = queue_depth)
3. Error Rate Alerts (alert_type = error_rate)
4. Latency Alerts (alert_type = latency)
5. Availability Alerts (alert_type = availability)
6. Gas Cost Alerts (alert_type = gas_cost)
7. Critical Alerts (severity = critical) - Fallback policy
8. Warning Alerts (severity = warning) - Fallback policy
```

## Complete Configuration Examples

### Scenario: Using Alertmanager as Notification Channel

If you use Alertmanager, you can simplify the configuration:

1. **Create Alertmanager notification channel** (refer to Grafana documentation)

2. **Create notification policies**:

   - **Policy 1**: `severity = critical` → Alertmanager
   - **Policy 2**: `severity = warning` → Alertmanager
   - **Policy 3**: `alert_type = profitability` → Alertmanager
   - Other policies similar...

3. **Configure routing in Alertmanager**:
   - Alertmanager will perform further routing based on alert labels
   - Configure Alertmanager routing rules separately

### Scenario: Direct Notification Channels in Grafana

If you configure Slack, Email, etc. directly in Grafana:

1. **Create notification channels**:

   - Critical Slack Channel
   - Warning Slack Channel
   - Finance Email
   - Operations Slack Channel
   - etc.

2. **Create notification policies**:
   - `severity = critical` → Critical Slack Channel
   - `severity = warning` → Warning Slack Channel
   - `alert_type = profitability` → Finance Email
   - `alert_type = queue_depth` → Operations Slack Channel
   - etc.

## Testing Configuration

1. **Create test alert rule**:

   - Set up a simple test alert
   - Ensure labels match your policies

2. **Trigger test alert**:

   - Wait for alert to trigger
   - Check if it routes to the correct notification channel

3. **Verify notification**:
   - Check Slack channel or Email
   - Confirm alert information is complete

## Best Practices

1. **Use label matching**: Fully utilize alert labels for routing
2. **Set reasonable grouping**: Use `Group by` to group related alerts
3. **Configure frequency control**: Set reasonable `Repeat interval` to avoid alert fatigue
4. **Priority order**: Place specific policies before general policies
5. **Test policies**: Thoroughly test notification policies before deployment

## Troubleshooting

### Alerts Not Routed to Expected Channel

1. **Check label matchers**:

   - Verify alert rule labels match matchers
   - Check if case matches

2. **Check policy order**:

   - Confirm policy order is correct
   - More specific policies should be before general policies

3. **Check notification channels**:
   - Verify notification channels are correctly configured
   - Test if notification channels work properly

### Alerts Sent Too Frequently

1. **Increase Repeat interval**: Extend repeat notification interval
2. **Adjust Group interval**: Increase grouping interval time
3. **Use Group by**: Group related alerts for sending

## Related Documentation

- [Alert Rules Configuration](./prometheus-alerts.yml) - View alert label definitions
- [Monitoring Guide](../monitoring.md) - Complete monitoring documentation
- [Grafana Alerting Official Documentation](https://grafana.com/docs/grafana/latest/alerting/)
