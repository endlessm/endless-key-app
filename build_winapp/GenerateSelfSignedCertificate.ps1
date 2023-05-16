# Usage:
#   GenerateSelfSignedCertificate.ps1 `
#     -certpassword <password defined on GitHub CI "secrets.SELFSIGN_PHRASE"> `
#     -outputpath <export file path>

param ([Parameter(Mandatory)]$CertPassword, $OutputPath='selfsign.pfx')

# * The "CN" of Subject is the Publisher: Endless OS Foundation's ID on
#   Microsoft store
# * TextExtension is Extended Key Usage. The value represents self-signing
#   certificate. Please see the document "Create a certificate for package
#   signing"
# https://learn.microsoft.com/en-us/windows/msix/package/create-certificate-package-signing#use-new-selfsignedcertificate-to-create-a-certificate
$NewCertCreateParameters = @{
    Type = 'Custom'
    Subject = 'CN=4B001A25-B854-44D9-BAD3-8AD7FC7A8761'
    TextExtension = @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
    KeyUsage = 'DigitalSignature'
    KeyAlgorithm = 'RSA'
    KeyLength = 2048
    FriendlyName = 'EOSFselfsign'
    CertStoreLocation = 'Cert:\CurrentUser\My'
    NotAfter = (Get-Date).AddYears(99)
    KeyExportPolicy = 'Exportable'
    OutVariable = 'Certificate'
}
New-SelfSignedCertificate @NewCertCreateParameters

$CertPasswordSec = ConvertTo-SecureString -String $CertPassword -Force -AsPlainText

$NewCertExportParameters = @{
    Cert = "Cert:\CurrentUser\My\$($Certificate.Thumbprint)"
    FilePath = $OutputPath
    Password = $CertPasswordSec
}
Export-PfxCertificate @NewCertExportParameters
