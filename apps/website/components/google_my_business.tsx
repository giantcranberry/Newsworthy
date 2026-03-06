// components/google_my_business.tsx

type GmbProps = {
  company: {
    gmb: string | null
  }
}

export default function GoogleMyBusiness({ company }: GmbProps) {
  let gmb: string = "";
  if (company.gmb) {
    gmb = company.gmb;
    gmb = gmb.replace('width="600" height="450"', '');
    gmb = gmb.replace('style="border:0;"', 'style="border:0; width:100%; height:450px; margin-top:15px; margin-bottom:15px;"');
  }
  return (
    <div dangerouslySetInnerHTML={{ __html: gmb }} />
  );
}
