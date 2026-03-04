'use client'

import { useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
} from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

interface Company {
  uuid: string
  companyName: string
}

interface ParsedRow {
  [key: string]: string
}

interface MappedRow {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  publication?: string
  tld?: string
  notes?: string
}

const FIELD_OPTIONS = [
  { value: 'skip', label: 'Skip' },
  { value: 'email', label: 'Email' },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'publication', label: 'Publication' },
  { value: 'tld', label: 'Domain (TLD)' },
  { value: 'notes', label: 'Notes' },
]

function guessMapping(header: string): string {
  const h = header.toLowerCase().trim()
  if (h === 'email' || h === 'e-mail' || h === 'email address' || h === 'emailaddress') return 'email'
  if (h === 'first name' || h === 'firstname' || h === 'first') return 'firstName'
  if (h === 'last name' || h === 'lastname' || h === 'last' || h === 'surname') return 'lastName'
  if (h === 'phone' || h === 'telephone' || h === 'tel' || h === 'mobile' || h === 'phone number') return 'phone'
  if (h === 'publication' || h === 'outlet' || h === 'media outlet' || h === 'company' || h === 'organization') return 'publication'
  if (h === 'domain' || h === 'tld' || h === 'website') return 'tld'
  if (h === 'notes' || h === 'note' || h === 'comment' || h === 'comments') return 'notes'
  return 'skip'
}

function downloadTemplate() {
  const csvContent = [
    'Email,First Name,Last Name,Phone,Publication,Domain,Notes',
    'john.doe@techcrunch.com,John,Doe,555-0100,TechCrunch,techcrunch.com,Senior reporter covering startups',
    'jane.smith@theverge.com,Jane,Smith,555-0200,The Verge,theverge.com,Tech editor',
    'alex@reuters.com,Alex,Johnson,,Reuters,reuters.com,Breaking news desk',
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'crm-import-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function CrmImportForm({ companies }: { companies: Company[] }) {
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file')
  const [selectedCompany, setSelectedCompany] = useState(companies[0]?.uuid || '')
  const [contactType, setContactType] = useState('media')

  // File import state
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [step, setStep] = useState<'upload' | 'map' | 'review' | 'done'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Text import state
  const [textInput, setTextInput] = useState('')

  // Shared state
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; errors?: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setFileName(file.name)

    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0 && results.data.length === 0) {
            setError('Failed to parse CSV file')
            return
          }
          const rows = results.data as ParsedRow[]
          const hdrs = results.meta.fields || []
          setHeaders(hdrs)
          setParsedRows(rows)
          const mapping: Record<string, string> = {}
          for (const h of hdrs) {
            mapping[h] = guessMapping(h)
          }
          setColumnMapping(mapping)
          setStep('map')
        },
      })
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const json = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: '' })

          if (json.length === 0) {
            setError('No data found in the spreadsheet')
            return
          }

          const hdrs = Object.keys(json[0])
          setHeaders(hdrs)
          setParsedRows(json)
          const mapping: Record<string, string> = {}
          for (const h of hdrs) {
            mapping[h] = guessMapping(h)
          }
          setColumnMapping(mapping)
          setStep('map')
        } catch {
          setError('Failed to parse Excel file')
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      setError('Please upload a .csv, .xlsx, or .xls file')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && fileInputRef.current) {
      const dt = new DataTransfer()
      dt.items.add(file)
      fileInputRef.current.files = dt.files
      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, [])

  const getMappedRows = (): MappedRow[] => {
    return parsedRows.map((row) => {
      const mapped: MappedRow = { email: '' }
      for (const [header, field] of Object.entries(columnMapping)) {
        if (field !== 'skip' && row[header]) {
          ;(mapped as any)[field] = String(row[header]).trim()
        }
      }
      return mapped
    }).filter((r) => r.email && r.email.includes('@'))
  }

  const validCount = getMappedRows().length

  const handleFileImport = async () => {
    const rows = getMappedRows()
    if (rows.length === 0) {
      setError('No valid rows with email addresses found')
      return
    }

    setIsImporting(true)
    setError(null)

    try {
      const response = await fetch(`/api/company/${selectedCompany}/crm/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, contactType }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Import failed')
      }

      const data = await response.json()
      setImportResult(data)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  const handleTextImport = async () => {
    if (!textInput.trim()) {
      setError('Please enter contacts to import')
      return
    }

    setIsImporting(true)
    setError(null)

    try {
      const response = await fetch(`/api/company/${selectedCompany}/crm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: textInput, contactType }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Import failed')
      }

      const data = await response.json()
      setImportResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  const resetFileImport = () => {
    setStep('upload')
    setFileName(null)
    setParsedRows([])
    setHeaders([])
    setColumnMapping({})
    setImportResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Company & Type selectors */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="import-company">Brand</Label>
              <Select
                id="import-company"
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="mt-1"
              >
                {companies.map((co) => (
                  <option key={co.uuid} value={co.uuid}>{co.companyName}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="import-type">Contact Type</Label>
              <Select
                id="import-type"
                value={contactType}
                onChange={(e) => setContactType(e.target.value)}
                className="mt-1"
              >
                <option value="media">Media</option>
                <option value="advocate">Advocate</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('file')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'file'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4 inline mr-1.5" />
          File Upload
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'text'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          Bulk Text
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* File Upload Tab */}
      {activeTab === 'file' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {step === 'upload' && 'Upload File'}
              {step === 'map' && 'Map Columns'}
              {step === 'review' && 'Review Import'}
              {step === 'done' && 'Import Complete'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === 'upload' && (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                >
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Drag and drop a file here, or click to browse
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    Accepts .csv, .xlsx, .xls
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </Button>
                </div>

                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Need a template?</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Download a sample CSV with the expected column headers and example data.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0 gap-1.5">
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                </div>
              </div>
            )}

            {step === 'map' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <FileSpreadsheet className="h-4 w-4 inline mr-1" />
                    {fileName} — {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} found
                  </p>
                  <Button variant="outline" size="sm" onClick={resetFileImport}>
                    <X className="h-4 w-4" />
                    Change File
                  </Button>
                </div>

                {/* Column mapping */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Map each column to a field:</p>
                  {headers.map((header) => (
                    <div key={header} className="flex items-center gap-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400 w-40 truncate" title={header}>
                        {header}
                      </span>
                      <Select
                        value={columnMapping[header] || 'skip'}
                        onChange={(e) => setColumnMapping((prev) => ({ ...prev, [header]: e.target.value }))}
                        className="w-48"
                      >
                        {FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </Select>
                      <span className="text-xs text-gray-400 truncate">
                        {parsedRows[0]?.[header] ? `e.g. "${parsedRows[0][header]}"` : '(empty)'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview (first 5 rows):</p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="border-b">
                          {headers.filter((h) => columnMapping[h] !== 'skip').map((h) => (
                            <th key={h} className="pb-1 pr-3 text-left font-medium text-gray-500 dark:text-gray-400">
                              {FIELD_OPTIONS.find((f) => f.value === columnMapping[h])?.label || h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-b last:border-0">
                            {headers.filter((h) => columnMapping[h] !== 'skip').map((h) => (
                              <td key={h} className="py-1 pr-3 text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
                                {row[h] || '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Validation summary */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <p className="text-sm">
                    <strong>{parsedRows.length}</strong> total rows,{' '}
                    <strong className="text-green-600 dark:text-green-400">{validCount}</strong> valid emails,{' '}
                    <strong className="text-amber-600 dark:text-amber-400">{parsedRows.length - validCount}</strong> will be skipped
                  </p>
                  {!Object.values(columnMapping).includes('email') && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      No column mapped to Email — please map at least one column to Email.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={resetFileImport}>Cancel</Button>
                  <Button
                    onClick={handleFileImport}
                    disabled={isImporting || validCount === 0 || !Object.values(columnMapping).includes('email')}
                  >
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Import {validCount} Contact{validCount !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            )}

            {step === 'done' && importResult && (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Import Complete</h3>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <p><strong className="text-green-600 dark:text-green-400">{importResult.added}</strong> contacts added</p>
                  <p><strong className="text-amber-600 dark:text-amber-400">{importResult.skipped}</strong> skipped (duplicates or invalid)</p>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="mt-3 text-left bg-red-50 dark:bg-red-900/20 rounded p-3">
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Errors:</p>
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-red-500 dark:text-red-400">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
                <Button className="mt-6" onClick={resetFileImport}>
                  Import More
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk Text Tab */}
      {activeTab === 'text' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bulk Text Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="text-import">Enter contacts (one per line)</Label>
              <p className="text-xs text-gray-400 mb-2">
                Format: email, firstName, lastName (comma-separated, firstName and lastName are optional)
              </p>
              <Textarea
                id="text-import"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={10}
                placeholder={`john@example.com, John, Doe\njane@example.com, Jane, Smith\ncontact@media.com`}
                className="font-mono text-sm"
              />
            </div>

            {importResult && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <CheckCircle2 className="h-5 w-5 text-green-500 inline mr-2" />
                <strong className="text-green-700 dark:text-green-400">{importResult.added}</strong> added,{' '}
                <strong className="text-amber-600 dark:text-amber-400">{importResult.skipped}</strong> skipped
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleTextImport} disabled={isImporting || !textInput.trim()}>
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Import Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
