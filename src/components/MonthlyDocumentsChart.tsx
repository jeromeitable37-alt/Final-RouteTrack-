"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CalendarDays, TrendingUp } from "lucide-react";
import {
  DOCUMENT_TYPES,
  DocumentRecord,
  DocumentType,
} from "@/lib/types";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type MonthlyBucket = {
  monthIndex: number;
  month: string;
  total: number;
} & Record<DocumentType, number>;

function recordDate(document: DocumentRecord): Date | null {
  const raw =
    document.dateRequested ||
    document.dateLogged ||
    document.createdAt;

  if (!raw) return null;

  const value = raw.includes("T") ? raw : `${raw}T00:00:00`;
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function segmentClass(type: DocumentType): string {
  return `monthly-segment monthly-segment-${type.toLowerCase()}`;
}

export function MonthlyDocumentsChart({
  documents,
}: {
  documents: DocumentRecord[];
}) {
  const currentYear = new Date().getFullYear();

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);

    documents.forEach((document) => {
      const date = recordDate(document);
      if (date) years.add(date.getFullYear());
    });

    return [...years].sort((a, b) => b - a);
  }, [currentYear, documents]);

  const [selectedYear, setSelectedYear] = useState(currentYear);

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0] || currentYear);
    }
  }, [availableYears, currentYear, selectedYear]);

  const monthlyData = useMemo<MonthlyBucket[]>(() => {
    const buckets = MONTH_LABELS.map((month, monthIndex) => ({
      monthIndex,
      month,
      total: 0,
      PRF: 0,
      SRF: 0,
      CRF: 0,
      PO: 0,
    }));

    documents.forEach((document) => {
      const date = recordDate(document);
      if (!date || date.getFullYear() !== selectedYear) return;

      const bucket = buckets[date.getMonth()];
      bucket[document.type] += 1;
      bucket.total += 1;
    });

    return buckets;
  }, [documents, selectedYear]);

  const totalForYear = monthlyData.reduce(
    (sum, item) => sum + item.total,
    0,
  );

  const maxTotal = Math.max(
    1,
    ...monthlyData.map((item) => item.total),
  );

  const peakMonth = monthlyData.reduce(
    (peak, item) => (item.total > peak.total ? item : peak),
    monthlyData[0],
  );

  const typeTotals = useMemo(
    () =>
      DOCUMENT_TYPES.map((type) => ({
        type,
        count: monthlyData.reduce(
          (sum, month) => sum + month[type],
          0,
        ),
      })),
    [monthlyData],
  );

  const topType = typeTotals.reduce(
    (top, item) => (item.count > top.count ? item : top),
    typeTotals[0],
  );

  const monthlyAverage = totalForYear / 12;

  return (
    <section className="panel monthly-documents-panel">
      <div className="monthly-chart-heading">
        <div>
          <div className="monthly-title-row">
            <p className="eyebrow">LIVE MONTHLY DATA</p>
            <span className="live-data-badge">
              <Activity size={13} /> Live
            </span>
          </div>
          <h2>Documents requested per month</h2>
          <p>
            Counts update automatically whenever a document is added or
            its requested date or type is edited.
          </p>
        </div>

        <label className="monthly-year-filter">
          <span>Year</span>
          <select
            value={selectedYear}
            onChange={(event) =>
              setSelectedYear(Number(event.target.value))
            }
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="monthly-chart-summary">
        <article>
          <CalendarDays size={18} />
          <div>
            <span>Total requested</span>
            <strong>{totalForYear}</strong>
          </div>
        </article>

        <article>
          <TrendingUp size={18} />
          <div>
            <span>Busiest month</span>
            <strong>
              {peakMonth.total
                ? `${MONTH_NAMES[peakMonth.monthIndex]} (${peakMonth.total})`
                : "No data"}
            </strong>
          </div>
        </article>

        <article>
          <BarChart3 size={18} />
          <div>
            <span>Monthly average</span>
            <strong>{monthlyAverage.toFixed(1)}</strong>
          </div>
        </article>

        <article>
          <Activity size={18} />
          <div>
            <span>Most requested type</span>
            <strong>
              {topType.count ? `${topType.type} (${topType.count})` : "No data"}
            </strong>
          </div>
        </article>
      </div>

      <div className="monthly-chart-scroll">
        <div
          className="monthly-chart"
          role="img"
          aria-label={`Monthly document request chart for ${selectedYear}`}
        >
          {monthlyData.map((item) => (
            <div
              className="monthly-bar-column"
              key={item.month}
              title={`${MONTH_NAMES[item.monthIndex]} ${selectedYear}: ${item.total} total — PRF ${item.PRF}, SRF ${item.SRF}, CRF ${item.CRF}, PO ${item.PO}`}
            >
              <span className="monthly-bar-total">{item.total}</span>

              <div className="monthly-bar-track">
                {DOCUMENT_TYPES.map((type) => {
                  const count = item[type];
                  const height = (count / maxTotal) * 100;

                  return count ? (
                    <div
                      key={type}
                      className={segmentClass(type)}
                      style={{ height: `${height}%` }}
                      aria-label={`${type}: ${count}`}
                    />
                  ) : null;
                })}
              </div>

              <strong>{item.month}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="monthly-chart-legend">
        {typeTotals.map((item) => (
          <span key={item.type}>
            <i className={`monthly-legend-${item.type.toLowerCase()}`} />
            {item.type}: <strong>{item.count}</strong>
          </span>
        ))}
      </div>

      <details className="monthly-data-details">
        <summary>View exact monthly data</summary>
        <div className="table-wrap monthly-data-table-wrap">
          <table className="monthly-data-table">
            <thead>
              <tr>
                <th>Month</th>
                {DOCUMENT_TYPES.map((type) => (
                  <th key={type}>{type}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((item) => (
                <tr key={item.month}>
                  <td>{MONTH_NAMES[item.monthIndex]}</td>
                  {DOCUMENT_TYPES.map((type) => (
                    <td key={type}>{item[type]}</td>
                  ))}
                  <td>
                    <strong>{item.total}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Year total</th>
                {typeTotals.map((item) => (
                  <th key={item.type}>{item.count}</th>
                ))}
                <th>{totalForYear}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>

      <p className="monthly-chart-note">
        The month is based on <strong>Date Requested</strong>. For older
        records without that value, RouteTrack uses Date Logged or the
        record creation date. Archived records remain included in the
        historical total.
      </p>
    </section>
  );
}
