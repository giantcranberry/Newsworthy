import { CompanyForm } from '../company-form'

export default function AddCompanyPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add Brand</h1>
        <p className="text-gray-500">Create a new brand profile for your press releases</p>
      </div>

      <CompanyForm />
    </div>
  )
}
