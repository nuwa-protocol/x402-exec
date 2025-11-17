# X402 Facilitator Monitoring Guide

This document explains how to use the Grafana Dashboard to monitor the performance and health status of the X402 Facilitator service.

## Overview

X402 Facilitator exports Prometheus-format metrics through OpenTelemetry, which can be collected by Prometheus and visualized in Grafana.

## Prerequisites

1. **Prometheus** - For collecting and storing metrics
2. **Grafana** - For visualizing dashboards
3. **OpenTelemetry Collector** (Optional) - If using OTLP protocol to export metrics

## Metrics Export Configuration

Facilitator exports metrics through OpenTelemetry. Ensure the OTLP endpoint is configured in environment variables:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-prometheus-endpoint:4318
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64_token>
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_SERVICE_NAME=x402-facilitator
OTEL_SERVICE_VERSION=1.0.0
```

### Prometheus Configuration

If using OpenTelemetry Collector, you need to configure the Prometheus receiver to scrape metrics. Alternatively, if using Prometheus directly, configure Prometheus to scrape the metrics endpoint exposed by the OpenTelemetry Collector.

**Example Prometheus Configuration** (`prometheus.yml`):

```yaml
scrape_configs:
  - job_name: 'x402-facilitator'
    static_configs:
      - targets: ['otel-collector:8888']  # OpenTelemetry Collector metrics endpoint
    scrape_interval: 15s
    scrape_timeout: 10s
```

## Dashboard Import

### Method 1: Import via Grafana UI

1. Log in to Grafana
2. Click **Dashboards** → **Import** in the left menu
3. Click **Upload JSON file** and select `docs/grafana-dashboard.json`
4. Or paste the JSON content directly
5. Select the Prometheus data source
6. Click **Import**

### Method 2: Import via Grafana API

```bash
curl -X POST \
  http://admin:admin@localhost:3000/api/dashboards/db \
  -H 'Content-Type: application/json' \
  -d @docs/grafana-dashboard.json
```

### Method 3: Via Terraform/Configuration Management Tools

If you use Infrastructure as Code (IaC), you can import the Dashboard JSON as a resource.

## Dashboard Structure

The dashboard contains the following 6 main sections:

### 1. Overview - Core KPIs

- **Request Rate**: Rate of verification and settlement requests
- **Success Rate**: Settlement success rate (target >99%)
- **Current Queue Depth**: Account queue depth (warning threshold: 7-9, critical threshold: ≥10)
- **Profitability Rate**: Percentage of profitable settlements

### 2. Settlement Performance

- **Settlement Rate by Network**: Settlement rate grouped by network
- **Settlement Duration (P50, P95, P99)**: Percentile metrics for settlement latency
- **Settlement by Mode**: Distribution of standard mode and SettlementRouter mode
- **Error Rate**: Error rates for settlement and verification

### 3. Profitability Analysis

- **Gas Cost vs Facilitator Fee**: Comparison of gas costs and facilitator fees
- **Profit Margin Distribution**: Histogram of profit distribution
- **Total Profit (24h)**: 24-hour total profit
- **Unprofitable Settlements**: Number of unprofitable settlements (warning threshold: 1-5, critical threshold: >5)

### 4. Gas Usage Analysis

- **Gas Used by Hook**: Average gas usage grouped by hook
- **Gas Cost Trend**: Gas cost trend (P50, P95)
- **Gas Efficiency**: Average gas usage per settlement

### 5. Account Pool Management

- **Queue Depth by Account**: Queue depth by account
- **Queue Rejection Rate**: Queue rejection rate (warning threshold: >0.5/min, critical threshold: >1/min)
- **Transaction Throughput by Account**: Transaction throughput by account
- **Transaction Success Rate by Account**: Transaction success rate table by account

### 6. Fee Management

- **Fee Query Rate**: Fee query rate (calculate fee and pending fees queries)
- **Fee Claims**: Fee claim rate by network

## Dashboard Variables

The dashboard provides the following filter variables:

- **$network**: Network filter (base-sepolia, x-layer-testnet, etc.)
- **$hook**: Hook address filter
- **$account**: Account address filter
- **$interval**: Time interval (1m, 5m, 10m, 30m, 1h)

Use these variables to quickly filter and view metrics for specific networks, hooks, or accounts.

## Metrics Description

### Counter Metrics

- `facilitator_verify_total`: Total verification requests
- `facilitator_settle_total`: Total settlement requests
- `facilitator_verify_errors`: Verification errors
- `facilitator_settle_errors`: Settlement errors
- `facilitator_account_queue_rejected`: Queue rejections
- `facilitator_account_tx_count`: Transaction count
- `facilitator_fee_query`: Fee queries
- `facilitator_pending_fees_query`: Pending fees queries
- `facilitator_fees_claimed`: Fee claims
- `facilitator_settlement_profitable`: Profitable settlement count

### Histogram Metrics

- `facilitator_verify_duration_ms`: Verification latency (milliseconds)
- `facilitator_settle_duration_ms`: Settlement latency (milliseconds)
- `facilitator_settlement_gas_used`: Gas usage
- `facilitator_settlement_gas_cost_usd`: Gas cost (USD)
- `facilitator_settlement_facilitator_fee_usd`: Facilitator fee (USD)
- `facilitator_settlement_profit_usd`: Profit (USD)

### Gauge Metrics

- `facilitator_account_queue_depth`: Account queue depth

## Alert Rules Configuration

We provide pre-configured Prometheus alert rule files containing the following alerts:

1. **High Error Rate Alert** - Settlement error rate exceeds 1%
2. **Low Success Rate Alert** - Settlement success rate below 99%
3. **Queue Overload Alert** - Account queue depth reaches maximum
4. **Low Profitability Alert** - Unprofitable settlements exceed 5%
5. **High Latency Alert** - P99 settlement latency exceeds 30 seconds
6. **Queue Rejection Rate Alert** - Queue rejection rate exceeds 1/min
7. **Verification Error Rate Alert** - Verification error rate exceeds 5%
8. **No Settlement Alert** - No settlement requests in 10 minutes
9. **High Gas Cost Alert** - Average gas cost exceeds 10 USD
10. **Negative Profit Alert** - Total profit is negative

### Import Alert Rules

Alert rule configuration file location: [`docs/alerts/prometheus-alerts.yml`](./alerts/prometheus-alerts.yml)

#### Prometheus Configuration

Add the alert rule file path in `prometheus.yml`:

```yaml
rule_files:
  - "docs/alerts/prometheus-alerts.yml"  # Adjust path as needed
```

Or if using Docker, mount the alert file into the container:

```yaml
volumes:
  - ./docs/alerts/prometheus-alerts.yml:/etc/prometheus/alerts/x402-facilitator.yml
```

Then reference it in `prometheus.yml`:

```yaml
rule_files:
  - "/etc/prometheus/alerts/x402-facilitator.yml"
```

#### Grafana Alerting

If using Grafana Alerting, please refer to:
- [Grafana Alerting Configuration Guide](./alerts/grafana-alerts-guide.md) - Alert rule configuration
- [Grafana Notification Policy Configuration Guide](./alerts/grafana-notification-policy-guide.md) - Notification policy and label matcher configuration

**Important Note**: Grafana Alerting uses JSON format, which differs from Prometheus's YAML format. It's recommended to manually create alert rules through the Grafana UI because:

1. Grafana's JSON format may vary by version
2. Data source references need to be configured through the UI
3. UI creation allows real-time testing of queries and conditions

**Notification Policy Configuration**: When creating notification policies in Grafana, you need to set matchers based on alert labels. Refer to [Grafana Notification Policy Configuration Guide](./alerts/grafana-notification-policy-guide.md) for how to configure label matchers.

#### Alert Notification Configuration

Alert notification policy configuration depends on the architecture you use:

##### Prometheus Alertmanager (Standalone Deployment)

Alert notification policy configuration file location: [`docs/alerts/alertmanager.yml`](./alerts/alertmanager.yml)

For detailed configuration instructions, refer to: [Alertmanager Configuration Guide](./alerts/alertmanager-config.md)

This configuration file includes:
- **Notification routing policies**: Route to different recipients based on alert severity and type
- **Notification channel configuration**: Slack, Email, Webhook, PagerDuty, etc.
- **Alert inhibition rules**: Prevent alert storms
- **Grouping and frequency control**: Control alert sending frequency

Main routing policies:
- **Critical alerts** → Immediate notification (Slack + Email + Webhook)
- **Warning alerts** → Delayed notification (Slack + Email)
- **Profitability-related alerts** → Finance team (Slack #x402-finance + Email)
- **Queue-related alerts** → Operations team (Slack #x402-operations)
- **Error rate alerts** → Error monitoring channel (Slack #x402-errors)

##### Using Alertmanager in Grafana (as Notification Channel)

If you use Prometheus Alertmanager as a notification channel in Grafana, you need to configure it in JSON format:

- **Configuration file**: [`docs/alerts/grafana-alertmanager-config.json`](./alerts/grafana-alertmanager-config.json) (JSON format)
- **Configuration guide**: [Grafana Alertmanager Configuration Guide](./alerts/grafana-alertmanager-guide.md)

**Important Distinction**:

These two files are **completely different** and serve different purposes:

| File | Format | Purpose | Reader |
|------|--------|---------|--------|
| `alertmanager.yml` | YAML | Alertmanager service configuration file, defines alert routing, recipients, notification channels (Slack, Email, etc.) | Prometheus Alertmanager service |
| `grafana-alertmanager-config.json` | JSON | Configure Alertmanager as notification channel in Grafana, only for connection configuration (URL, authentication) | Grafana service |

**Workflow**:
```
Grafana Alert Rule → Grafana Alerting Engine 
  → (connect via grafana-alertmanager-config.json) 
  → Prometheus Alertmanager 
  → (route according to alertmanager.yml) 
  → Notification channels (Slack, Email, etc.)
```

**Both configurations are needed**:
1. `grafana-alertmanager-config.json` (JSON) - Tells Grafana how to **connect** to Alertmanager
2. `alertmanager.yml` (YAML) - Tells Alertmanager how to **handle** alerts (routing, grouping, sending)

## Troubleshooting

### Metrics Not Displaying

1. **Check OpenTelemetry Configuration**
   - Verify `OTEL_EXPORTER_OTLP_ENDPOINT` is set
   - Check service startup logs for "OpenTelemetry tracing and metrics exporter is enabled" message
   - Look for "First metric recorded - metrics collection is active" log

2. **Check Prometheus Configuration**
   - Verify Prometheus is scraping metrics
   - Check Prometheus targets page to confirm target status is "UP"
   - Test if metrics exist in Prometheus query interface: `facilitator_settle_total`

3. **Check Network Connectivity**
   - Verify Facilitator can access OTLP endpoint
   - Check firewall rules

### Dashboard Query Errors

1. **Check Data Source Configuration**
   - Verify Prometheus data source is correctly configured
   - Test data source connection

2. **Check Metric Names**
   - OpenTelemetry metric names have dots converted to underscores
   - Example: `facilitator.verify.total` → `facilitator_verify_total`

3. **Check Time Range**
   - Verify Prometheus has sufficient historical data
   - Adjust dashboard time range

### Performance Issues

1. **Reduce Query Frequency**
   - Increase `$interval` variable value
   - Reduce dashboard refresh frequency

2. **Optimize Queries**
   - Use shorter time ranges
   - Reduce number of label filters

## Best Practices

1. **Regular Metric Review**
   - Check success rate, error rate, and profitability rate daily
   - Review gas usage efficiency and cost trends weekly

2. **Set Alert Thresholds**
   - Adjust alert thresholds based on actual business needs
   - Avoid alert fatigue (don't set overly sensitive thresholds)

3. **Monitor Key Metrics**
   - Focus on success rate (target >99%)
   - Monitor queue depth to prevent overload
   - Track profitability to ensure business sustainability

4. **Capacity Planning**
   - Use queue depth and throughput metrics for capacity planning
   - Scale up proactively based on transaction volume growth trends

5. **Cost Optimization**
   - Monitor gas cost trends
   - Identify hooks with high gas consumption
   - Optimize facilitator fee settings

## Related Documentation

- [Facilitator README](../README.md) - Complete Facilitator documentation
- [Gas Metrics Monitoring](./gas-metrics-monitoring.md) - Detailed gas metrics monitoring guide
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/) - Official OpenTelemetry documentation

## Support

For questions or suggestions, please submit an Issue or contact the maintenance team.
