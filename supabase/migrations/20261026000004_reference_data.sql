-- =====================================================================
-- Reference data required by the store (safe to run in production).
-- Demo products live separately in supabase/seed.sql.
-- =====================================================================

-- Countries: only Nigeria is enabled. Enable others from Admin → Shipping
-- once you have VERIFIED rates for them.
insert into public.countries (code, name, is_enabled, region_label, region_required, postal_label, postal_required, sort_order) values
  ('AF', 'Afghanistan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AL', 'Albania', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('DZ', 'Algeria', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AS', 'American Samoa', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AD', 'Andorra', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AO', 'Angola', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AI', 'Anguilla', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AQ', 'Antarctica', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AG', 'Antigua and Barbuda', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AR', 'Argentina', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AM', 'Armenia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AW', 'Aruba', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AU', 'Australia', false, 'State / Territory', true, 'Postcode', true, 100),
  ('AT', 'Austria', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AZ', 'Azerbaijan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BS', 'Bahamas', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BH', 'Bahrain', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BD', 'Bangladesh', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BB', 'Barbados', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BY', 'Belarus', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BE', 'Belgium', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BZ', 'Belize', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BJ', 'Benin', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BM', 'Bermuda', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BT', 'Bhutan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BO', 'Bolivia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BQ', 'Bonaire, Sint Eustatius and Saba', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BA', 'Bosnia and Herzegovina', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BW', 'Botswana', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BV', 'Bouvet Island', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BR', 'Brazil', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('IO', 'British Indian Ocean Territory', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BN', 'Brunei Darussalam', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BG', 'Bulgaria', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BF', 'Burkina Faso', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BI', 'Burundi', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CV', 'Cabo Verde', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('KH', 'Cambodia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CM', 'Cameroon', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CA', 'Canada', false, 'Province', true, 'Postal code', true, 100),
  ('KY', 'Cayman Islands', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CF', 'Central African Republic', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TD', 'Chad', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CL', 'Chile', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CN', 'China', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CX', 'Christmas Island', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CC', 'Cocos (Keeling) Islands', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CO', 'Colombia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('KM', 'Comoros', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CG', 'Congo', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CD', 'Congo, The Democratic Republic of the', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CK', 'Cook Islands', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CR', 'Costa Rica', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('HR', 'Croatia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CU', 'Cuba', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CW', 'Curaçao', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CY', 'Cyprus', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CZ', 'Czechia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CI', 'Côte d''Ivoire', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('DK', 'Denmark', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('DJ', 'Djibouti', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('DM', 'Dominica', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('DO', 'Dominican Republic', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('EC', 'Ecuador', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('EG', 'Egypt', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SV', 'El Salvador', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GQ', 'Equatorial Guinea', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('ER', 'Eritrea', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('EE', 'Estonia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SZ', 'Eswatini', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('ET', 'Ethiopia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('FK', 'Falkland Islands (Malvinas)', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('FO', 'Faroe Islands', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('FJ', 'Fiji', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('FI', 'Finland', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('FR', 'France', false, 'Region', false, 'Postal code', true, 100),
  ('GF', 'French Guiana', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PF', 'French Polynesia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TF', 'French Southern Territories', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GA', 'Gabon', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GM', 'Gambia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GE', 'Georgia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('DE', 'Germany', false, 'State', false, 'Postal code', true, 100),
  ('GH', 'Ghana', false, 'Region', true, 'Postal code', false, 100),
  ('GI', 'Gibraltar', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GR', 'Greece', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GL', 'Greenland', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GD', 'Grenada', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GP', 'Guadeloupe', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GU', 'Guam', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GT', 'Guatemala', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GG', 'Guernsey', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GN', 'Guinea', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GW', 'Guinea-Bissau', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('GY', 'Guyana', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('HT', 'Haiti', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('HM', 'Heard Island and McDonald Islands', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('VA', 'Holy See (Vatican City State)', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('HN', 'Honduras', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('HK', 'Hong Kong', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('HU', 'Hungary', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('IS', 'Iceland', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('IN', 'India', false, 'State', true, 'PIN code', true, 100),
  ('ID', 'Indonesia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('IR', 'Iran', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('IQ', 'Iraq', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('IE', 'Ireland', false, 'County', true, 'Eircode', false, 100),
  ('IM', 'Isle of Man', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('IL', 'Israel', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('IT', 'Italy', false, 'Province', false, 'Postal code', true, 100),
  ('JM', 'Jamaica', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('JP', 'Japan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('JE', 'Jersey', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('JO', 'Jordan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('KZ', 'Kazakhstan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('KE', 'Kenya', false, 'County', false, 'Postal code', false, 100),
  ('KI', 'Kiribati', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('KP', 'North Korea', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('KR', 'South Korea', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('KW', 'Kuwait', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('KG', 'Kyrgyzstan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('LA', 'Laos', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('LV', 'Latvia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('LB', 'Lebanon', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('LS', 'Lesotho', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('LR', 'Liberia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('LY', 'Libya', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('LI', 'Liechtenstein', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('LT', 'Lithuania', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('LU', 'Luxembourg', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MO', 'Macao', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MG', 'Madagascar', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MW', 'Malawi', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MY', 'Malaysia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MV', 'Maldives', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('ML', 'Mali', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MT', 'Malta', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MH', 'Marshall Islands', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MQ', 'Martinique', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MR', 'Mauritania', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MU', 'Mauritius', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('YT', 'Mayotte', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MX', 'Mexico', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('FM', 'Micronesia, Federated States of', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MD', 'Moldova', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MC', 'Monaco', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MN', 'Mongolia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('ME', 'Montenegro', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MS', 'Montserrat', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MA', 'Morocco', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MZ', 'Mozambique', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MM', 'Myanmar', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('NA', 'Namibia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('NR', 'Nauru', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('NP', 'Nepal', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('NL', 'Netherlands', false, 'Province', false, 'Postal code', true, 100),
  ('NC', 'New Caledonia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('NZ', 'New Zealand', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('NI', 'Nicaragua', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('NE', 'Niger', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('NG', 'Nigeria', true, 'State', true, 'Postal code', false, 1),
  ('NU', 'Niue', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('NF', 'Norfolk Island', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MK', 'North Macedonia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MP', 'Northern Mariana Islands', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('NO', 'Norway', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('OM', 'Oman', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PK', 'Pakistan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PW', 'Palau', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PS', 'Palestine, State of', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PA', 'Panama', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PG', 'Papua New Guinea', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PY', 'Paraguay', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PE', 'Peru', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PH', 'Philippines', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PN', 'Pitcairn', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PL', 'Poland', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PT', 'Portugal', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PR', 'Puerto Rico', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('QA', 'Qatar', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('RO', 'Romania', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('RU', 'Russian Federation', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('RW', 'Rwanda', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('RE', 'Réunion', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('BL', 'Saint Barthélemy', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SH', 'Saint Helena, Ascension and Tristan da Cunha', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('KN', 'Saint Kitts and Nevis', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('LC', 'Saint Lucia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('MF', 'Saint Martin (French part)', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('PM', 'Saint Pierre and Miquelon', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('VC', 'Saint Vincent and the Grenadines', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('WS', 'Samoa', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SM', 'San Marino', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('ST', 'Sao Tome and Principe', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SA', 'Saudi Arabia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SN', 'Senegal', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('RS', 'Serbia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SC', 'Seychelles', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SL', 'Sierra Leone', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SG', 'Singapore', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SX', 'Sint Maarten (Dutch part)', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SK', 'Slovakia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SI', 'Slovenia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SB', 'Solomon Islands', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SO', 'Somalia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('ZA', 'South Africa', false, 'Province', true, 'Postal code', true, 100),
  ('GS', 'South Georgia and the South Sandwich Islands', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SS', 'South Sudan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('ES', 'Spain', false, 'Province', false, 'Postal code', true, 100),
  ('LK', 'Sri Lanka', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SD', 'Sudan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SR', 'Suriname', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SJ', 'Svalbard and Jan Mayen', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SE', 'Sweden', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('CH', 'Switzerland', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('SY', 'Syria', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TW', 'Taiwan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TJ', 'Tajikistan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TZ', 'Tanzania', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TH', 'Thailand', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TL', 'Timor-Leste', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TG', 'Togo', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TK', 'Tokelau', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TO', 'Tonga', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TT', 'Trinidad and Tobago', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TN', 'Tunisia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TM', 'Turkmenistan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TC', 'Turks and Caicos Islands', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TV', 'Tuvalu', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('TR', 'Türkiye', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('UG', 'Uganda', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('UA', 'Ukraine', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AE', 'United Arab Emirates', false, 'Emirate', true, 'Postal code', false, 100),
  ('GB', 'United Kingdom', false, 'County', false, 'Postcode', true, 100),
  ('US', 'United States', false, 'State', true, 'ZIP code', true, 100),
  ('UM', 'United States Minor Outlying Islands', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('UY', 'Uruguay', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('UZ', 'Uzbekistan', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('VU', 'Vanuatu', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('VE', 'Venezuela', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('VN', 'Vietnam', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('VG', 'Virgin Islands, British', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('VI', 'Virgin Islands, U.S.', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('WF', 'Wallis and Futuna', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('EH', 'Western Sahara', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('YE', 'Yemen', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('ZM', 'Zambia', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('ZW', 'Zimbabwe', false, 'State / Province / Region', false, 'Postal code', false, 100),
  ('AX', 'Åland Islands', false, 'State / Province / Region', false, 'Postal code', false, 100)
on conflict (code) do nothing;

insert into public.regions (country_code, code, name) values
  ('NG', 'AB', 'Abia'),
  ('NG', 'FC', 'Federal Capital Territory (Abuja)'),
  ('NG', 'AD', 'Adamawa'),
  ('NG', 'AK', 'Akwa Ibom'),
  ('NG', 'AN', 'Anambra'),
  ('NG', 'BA', 'Bauchi'),
  ('NG', 'BY', 'Bayelsa'),
  ('NG', 'BE', 'Benue'),
  ('NG', 'BO', 'Borno'),
  ('NG', 'CR', 'Cross River'),
  ('NG', 'DE', 'Delta'),
  ('NG', 'EB', 'Ebonyi'),
  ('NG', 'ED', 'Edo'),
  ('NG', 'EK', 'Ekiti'),
  ('NG', 'EN', 'Enugu'),
  ('NG', 'GO', 'Gombe'),
  ('NG', 'IM', 'Imo'),
  ('NG', 'JI', 'Jigawa'),
  ('NG', 'KD', 'Kaduna'),
  ('NG', 'KN', 'Kano'),
  ('NG', 'KT', 'Katsina'),
  ('NG', 'KE', 'Kebbi'),
  ('NG', 'KO', 'Kogi'),
  ('NG', 'KW', 'Kwara'),
  ('NG', 'LA', 'Lagos'),
  ('NG', 'NA', 'Nasarawa'),
  ('NG', 'NI', 'Niger'),
  ('NG', 'OG', 'Ogun'),
  ('NG', 'ON', 'Ondo'),
  ('NG', 'OS', 'Osun'),
  ('NG', 'OY', 'Oyo'),
  ('NG', 'PL', 'Plateau'),
  ('NG', 'RI', 'Rivers'),
  ('NG', 'SO', 'Sokoto'),
  ('NG', 'TA', 'Taraba'),
  ('NG', 'YO', 'Yobe'),
  ('NG', 'ZA', 'Zamfara'),
  ('US', 'AL', 'Alabama'),
  ('US', 'AK', 'Alaska'),
  ('US', 'AS', 'American Samoa'),
  ('US', 'AZ', 'Arizona'),
  ('US', 'AR', 'Arkansas'),
  ('US', 'CA', 'California'),
  ('US', 'CO', 'Colorado'),
  ('US', 'CT', 'Connecticut'),
  ('US', 'DE', 'Delaware'),
  ('US', 'DC', 'District of Columbia'),
  ('US', 'FL', 'Florida'),
  ('US', 'GA', 'Georgia'),
  ('US', 'GU', 'Guam'),
  ('US', 'HI', 'Hawaii'),
  ('US', 'ID', 'Idaho'),
  ('US', 'IL', 'Illinois'),
  ('US', 'IN', 'Indiana'),
  ('US', 'IA', 'Iowa'),
  ('US', 'KS', 'Kansas'),
  ('US', 'KY', 'Kentucky'),
  ('US', 'LA', 'Louisiana'),
  ('US', 'ME', 'Maine'),
  ('US', 'MD', 'Maryland'),
  ('US', 'MA', 'Massachusetts'),
  ('US', 'MI', 'Michigan'),
  ('US', 'MN', 'Minnesota'),
  ('US', 'MS', 'Mississippi'),
  ('US', 'MO', 'Missouri'),
  ('US', 'MT', 'Montana'),
  ('US', 'NE', 'Nebraska'),
  ('US', 'NV', 'Nevada'),
  ('US', 'NH', 'New Hampshire'),
  ('US', 'NJ', 'New Jersey'),
  ('US', 'NM', 'New Mexico'),
  ('US', 'NY', 'New York'),
  ('US', 'NC', 'North Carolina'),
  ('US', 'ND', 'North Dakota'),
  ('US', 'MP', 'Northern Mariana Islands'),
  ('US', 'OH', 'Ohio'),
  ('US', 'OK', 'Oklahoma'),
  ('US', 'OR', 'Oregon'),
  ('US', 'PA', 'Pennsylvania'),
  ('US', 'PR', 'Puerto Rico'),
  ('US', 'RI', 'Rhode Island'),
  ('US', 'SC', 'South Carolina'),
  ('US', 'SD', 'South Dakota'),
  ('US', 'TN', 'Tennessee'),
  ('US', 'TX', 'Texas'),
  ('US', 'UM', 'United States Minor Outlying Islands'),
  ('US', 'UT', 'Utah'),
  ('US', 'VT', 'Vermont'),
  ('US', 'VI', 'Virgin Islands, U.S.'),
  ('US', 'VA', 'Virginia'),
  ('US', 'WA', 'Washington'),
  ('US', 'WV', 'West Virginia'),
  ('US', 'WI', 'Wisconsin'),
  ('US', 'WY', 'Wyoming'),
  ('CA', 'AB', 'Alberta'),
  ('CA', 'BC', 'British Columbia'),
  ('CA', 'MB', 'Manitoba'),
  ('CA', 'NB', 'New Brunswick'),
  ('CA', 'NL', 'Newfoundland and Labrador'),
  ('CA', 'NT', 'Northwest Territories'),
  ('CA', 'NS', 'Nova Scotia'),
  ('CA', 'NU', 'Nunavut'),
  ('CA', 'ON', 'Ontario'),
  ('CA', 'PE', 'Prince Edward Island'),
  ('CA', 'QC', 'Quebec'),
  ('CA', 'SK', 'Saskatchewan'),
  ('CA', 'YT', 'Yukon'),
  ('AU', 'ACT', 'Australian Capital Territory'),
  ('AU', 'NSW', 'New South Wales'),
  ('AU', 'NT', 'Northern Territory'),
  ('AU', 'QLD', 'Queensland'),
  ('AU', 'SA', 'South Australia'),
  ('AU', 'TAS', 'Tasmania'),
  ('AU', 'VIC', 'Victoria'),
  ('AU', 'WA', 'Western Australia'),
  ('GH', 'AF', 'Ahafo'),
  ('GH', 'AH', 'Ashanti'),
  ('GH', 'BO', 'Bono'),
  ('GH', 'BE', 'Bono East'),
  ('GH', 'CP', 'Central'),
  ('GH', 'EP', 'Eastern'),
  ('GH', 'AA', 'Greater Accra'),
  ('GH', 'NE', 'North East'),
  ('GH', 'NP', 'Northern'),
  ('GH', 'OT', 'Oti'),
  ('GH', 'SV', 'Savannah'),
  ('GH', 'UE', 'Upper East'),
  ('GH', 'UW', 'Upper West'),
  ('GH', 'TV', 'Volta'),
  ('GH', 'WP', 'Western'),
  ('GH', 'WN', 'Western North'),
  ('KE', '01', 'Baringo'),
  ('KE', '02', 'Bomet'),
  ('KE', '03', 'Bungoma'),
  ('KE', '04', 'Busia'),
  ('KE', '05', 'Elgeyo/Marakwet'),
  ('KE', '06', 'Embu'),
  ('KE', '07', 'Garissa'),
  ('KE', '08', 'Homa Bay'),
  ('KE', '09', 'Isiolo'),
  ('KE', '10', 'Kajiado'),
  ('KE', '11', 'Kakamega'),
  ('KE', '12', 'Kericho'),
  ('KE', '13', 'Kiambu'),
  ('KE', '14', 'Kilifi'),
  ('KE', '15', 'Kirinyaga'),
  ('KE', '16', 'Kisii'),
  ('KE', '17', 'Kisumu'),
  ('KE', '18', 'Kitui'),
  ('KE', '19', 'Kwale'),
  ('KE', '20', 'Laikipia'),
  ('KE', '21', 'Lamu'),
  ('KE', '22', 'Machakos'),
  ('KE', '23', 'Makueni'),
  ('KE', '24', 'Mandera'),
  ('KE', '25', 'Marsabit'),
  ('KE', '26', 'Meru'),
  ('KE', '27', 'Migori'),
  ('KE', '28', 'Mombasa'),
  ('KE', '29', 'Murang''a'),
  ('KE', '30', 'Nairobi City'),
  ('KE', '31', 'Nakuru'),
  ('KE', '32', 'Nandi'),
  ('KE', '33', 'Narok'),
  ('KE', '34', 'Nyamira'),
  ('KE', '35', 'Nyandarua'),
  ('KE', '36', 'Nyeri'),
  ('KE', '37', 'Samburu'),
  ('KE', '38', 'Siaya'),
  ('KE', '39', 'Taita/Taveta'),
  ('KE', '40', 'Tana River'),
  ('KE', '41', 'Tharaka-Nithi'),
  ('KE', '42', 'Trans Nzoia'),
  ('KE', '43', 'Turkana'),
  ('KE', '44', 'Uasin Gishu'),
  ('KE', '45', 'Vihiga'),
  ('KE', '46', 'Wajir'),
  ('KE', '47', 'West Pokot'),
  ('ZA', 'EC', 'Eastern Cape'),
  ('ZA', 'FS', 'Free State'),
  ('ZA', 'GP', 'Gauteng'),
  ('ZA', 'KZN', 'Kwazulu-Natal'),
  ('ZA', 'LP', 'Limpopo'),
  ('ZA', 'MP', 'Mpumalanga'),
  ('ZA', 'NW', 'North-West'),
  ('ZA', 'NC', 'Northern Cape'),
  ('ZA', 'WC', 'Western Cape'),
  ('IN', 'AN', 'Andaman and Nicobar Islands'),
  ('IN', 'AP', 'Andhra Pradesh'),
  ('IN', 'AR', 'Arunāchal Pradesh'),
  ('IN', 'AS', 'Assam'),
  ('IN', 'BR', 'Bihār'),
  ('IN', 'CH', 'Chandīgarh'),
  ('IN', 'CG', 'Chhattīsgarh'),
  ('IN', 'DL', 'Delhi'),
  ('IN', 'DH', 'Dādra and Nagar Haveli and Damān and Diu'),
  ('IN', 'GA', 'Goa'),
  ('IN', 'GJ', 'Gujarāt'),
  ('IN', 'HR', 'Haryāna'),
  ('IN', 'HP', 'Himāchal Pradesh'),
  ('IN', 'JK', 'Jammu and Kashmīr'),
  ('IN', 'JH', 'Jhārkhand'),
  ('IN', 'KA', 'Karnātaka'),
  ('IN', 'KL', 'Kerala'),
  ('IN', 'LA', 'Ladākh'),
  ('IN', 'LD', 'Lakshadweep'),
  ('IN', 'MP', 'Madhya Pradesh'),
  ('IN', 'MH', 'Mahārāshtra'),
  ('IN', 'MN', 'Manipur'),
  ('IN', 'ML', 'Meghālaya'),
  ('IN', 'MZ', 'Mizoram'),
  ('IN', 'NL', 'Nāgāland'),
  ('IN', 'OD', 'Odisha'),
  ('IN', 'PY', 'Puducherry'),
  ('IN', 'PB', 'Punjab'),
  ('IN', 'RJ', 'Rājasthān'),
  ('IN', 'SK', 'Sikkim'),
  ('IN', 'TN', 'Tamil Nādu'),
  ('IN', 'TS', 'Telangāna'),
  ('IN', 'TR', 'Tripura'),
  ('IN', 'UP', 'Uttar Pradesh'),
  ('IN', 'UK', 'Uttarākhand'),
  ('IN', 'WB', 'West Bengal'),
  ('AE', 'AZ', 'Abū Z̧aby'),
  ('AE', 'FU', 'Al Fujayrah'),
  ('AE', 'SH', 'Ash Shāriqah'),
  ('AE', 'DU', 'Dubayy'),
  ('AE', 'RK', 'Ra’s al Khaymah'),
  ('AE', 'UQ', 'Umm al Qaywayn'),
  ('AE', 'AJ', '‘Ajmān')
on conflict (country_code, code) do nothing;


-- ---------------------------------------------------------------------
-- Catalogue structure (editable in Admin → Categories)
-- ---------------------------------------------------------------------
with top as (
  insert into public.categories (slug, name, description, sort_order) values
    ('men', 'Men''s Clothing', 'Sharp essentials and statement pieces for him.', 1),
    ('women', 'Women''s Clothing', 'Dresses, sets and separates with presence.', 2),
    ('bags', 'Bags', 'Handbags, totes and evening bags to finish the look.', 3),
    ('womens-shoes', 'Women''s Shoes', 'Heels, flats, sandals and boots.', 4),
    ('sneakers', 'Sneakers', 'Everyday and sport-inspired sneakers.', 5)
  returning id, slug
)
insert into public.categories (parent_id, slug, name, sort_order)
select top.id, s.slug, s.name, s.sort_order
from top
join (values
  ('men', 't-shirts', 'T-shirts', 1),
  ('men', 'shirts', 'Shirts', 2),
  ('men', 'trousers', 'Trousers', 3),
  ('men', 'jeans', 'Jeans', 4),
  ('men', 'hoodies-sweatshirts', 'Hoodies & Sweatshirts', 5),
  ('men', 'jackets-outerwear', 'Jackets & Outerwear', 6),
  ('men', 'shorts', 'Shorts', 7),
  ('women', 'dresses', 'Dresses', 1),
  ('women', 'tops-blouses', 'Tops & Blouses', 2),
  ('women', 'skirts', 'Skirts', 3),
  ('women', 'trousers-jeans', 'Trousers & Jeans', 4),
  ('women', 'matching-sets', 'Matching Sets', 5),
  ('women', 'hoodies-sweatshirts', 'Hoodies & Sweatshirts', 6),
  ('women', 'jackets-outerwear', 'Jackets & Outerwear', 7),
  ('bags', 'handbags', 'Handbags', 1),
  ('bags', 'shoulder-bags', 'Shoulder Bags', 2),
  ('bags', 'crossbody-bags', 'Crossbody Bags', 3),
  ('bags', 'tote-bags', 'Tote Bags', 4),
  ('bags', 'backpacks', 'Backpacks', 5),
  ('bags', 'evening-bags', 'Evening Bags', 6),
  ('womens-shoes', 'heels', 'Heels', 1),
  ('womens-shoes', 'flats', 'Flats', 2),
  ('womens-shoes', 'sandals', 'Sandals', 3),
  ('womens-shoes', 'boots', 'Boots', 4),
  ('womens-shoes', 'casual-shoes', 'Casual Shoes', 5),
  ('sneakers', 'mens-sneakers', 'Men''s Sneakers', 1),
  ('sneakers', 'womens-sneakers', 'Women''s Sneakers', 2),
  ('sneakers', 'unisex-sneakers', 'Unisex Sneakers', 3),
  ('sneakers', 'casual-sneakers', 'Casual Sneakers', 4),
  ('sneakers', 'sport-inspired-sneakers', 'Sport-Inspired Sneakers', 5)
) as s(parent, slug, name, sort_order) on s.parent = top.slug;

-- ---------------------------------------------------------------------
-- Shipping — DEVELOPMENT DEFAULTS ONLY.
-- These are sample values, NOT verified courier prices. Every rate is
-- flagged needs_review = true and the admin dashboard shows a warning
-- until you confirm or edit each one. No international rates are set.
-- ---------------------------------------------------------------------
insert into public.shipping_methods (name, description, is_active, sort_order) values
  ('Standard delivery', 'Manual rate set by Attitude Collections.', true, 1),
  ('Express delivery', 'Configure a rate before enabling.', false, 2);

with z as (
  insert into public.shipping_zones (name, description, priority) values
    ('Same-city delivery (Lagos)', 'DEVELOPMENT DEFAULT — set this zone to your actual dispatch city before launch.', 10),
    ('Nigeria — other destinations', 'Every other Nigerian state and city.', 0)
  returning id, name
),
loc as (
  insert into public.shipping_zone_locations (zone_id, country_code, region_code, city)
  select z.id, 'NG', case when z.name like 'Same-city%' then 'LA' end, case when z.name like 'Same-city%' then 'Lagos' end
  from z
  returning zone_id
)
insert into public.shipping_rates (zone_id, method_id, rate_type, fee, currency, is_manual, needs_review, notes)
select z.id, m.id, 'flat',
       case when z.name like 'Same-city%' then 250000 else 400000 end,
       'NGN', true, true,
       'Development default (sample value, not a verified courier price). Confirm or edit before launch.'
from z cross join public.shipping_methods m
where m.name = 'Standard delivery';

-- ---------------------------------------------------------------------
-- Store settings (edit in Admin → Settings). Placeholders are null.
-- ---------------------------------------------------------------------
insert into public.store_settings (key, value, is_public) values
  ('announcement', '{"enabled": true, "text": "New season pieces are here — explore the latest arrivals.", "href": "/shop?sort=newest"}', true),
  ('store', '{"name": "Attitude Collections", "tagline": "Wear Your Attitude.", "currency": "NGN", "support_email": null, "support_phone": null, "whatsapp": null, "business_address": null, "business_hours": null, "instagram": null, "tiktok": null, "facebook": null, "x": null}', true),
  ('checkout', '{"guest_checkout_enabled": true, "max_quantity_per_item": 10}', true),
  ('tax', '{"mode": "none", "rate_bps": 0, "label": "VAT", "duties_notice": "International orders may be subject to import duties, taxes or customs fees charged by the destination country. These charges are not included in your order total and are the responsibility of the recipient."}', true),
  ('home', '{"show_new_arrivals": true, "show_best_sellers": true, "show_featured_products": true, "intro_title": "Fashion with a point of view.", "intro_body": "Attitude Collections curates confident clothing, shoes and bags for people who dress with intention. Every piece is chosen to be worn, styled and remembered."}', true);

-- ---------------------------------------------------------------------
-- Homepage banners (edit in Admin → Homepage)
-- ---------------------------------------------------------------------
insert into public.home_banners (placement, eyebrow, title, subtitle, cta_label, cta_href, image_url, sort_order) values
  ('hero', 'Attitude Collections', 'Wear Your Attitude.',
   'Statement clothing, shoes and bags curated for confident, modern dressing.',
   'Shop Now', '/shop', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1800&q=80', 1),
  ('promo', 'The Evening Edit', 'After-dark dressing',
   'Dresses, heels and evening bags made for the moment.',
   'Shop women', '/shop/women', 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1400&q=80', 1),
  ('promo', 'Off-duty', 'Sneaker season',
   'Clean, everyday sneakers for him and her.',
   'Shop sneakers', '/shop/sneakers', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1400&q=80', 2);

-- ---------------------------------------------------------------------
-- Editable content pages. Text in [square brackets] is a placeholder that
-- MUST be completed by the business owner — nothing here is invented.
-- ---------------------------------------------------------------------
insert into public.content_pages (slug, title, summary, body) values
('about', 'About Attitude Collections', 'Fashion with a point of view.',
$md$## Our story

Attitude Collections was created for people who believe what you wear says something before you do. We bring together clothing, shoes and bags with presence: pieces that are easy to wear and hard to forget.

## What we offer

- Men's and women's clothing, from everyday essentials to statement pieces
- Women's shoes, sneakers and bags to complete the look
- Delivery across Nigeria, and to selected international destinations where shipping has been configured

## How we work

We work with carefully selected suppliers. Some items are dispatched directly from our supplier partners, which is why delivery estimates are shown per destination at checkout.

## Get in touch

Questions about an order, sizing or styling? Visit our [Contact page](/contact) — we would love to hear from you.

[Add your founder story, mission and any verified details about the business here.]$md$),

('faq', 'Frequently Asked Questions', 'Answers to common questions about orders, delivery and returns.',
$md$## Orders

### How do I place an order?
Choose your size and colour, add the item to your bag and check out. You can check out as a guest or with an account.

### Can I change or cancel my order?
Contact us as soon as possible with your order number. We can only change or cancel orders that have not yet been dispatched. [Confirm your cancellation process.]

## Delivery

### Where do you deliver?
We deliver within Nigeria and to international destinations that are enabled at checkout. If your destination is not available, checkout will tell you before you pay.

### How much is delivery?
Delivery fees depend on your destination and the delivery method you choose. The exact fee is calculated and shown at checkout before payment.

### How can I track my order?
Use the [Track Order](/track-order) page with your order number and email address, or view your orders in your account.

## Payments

### How can I pay?
Payments are processed securely by our payment provider. Available payment methods are shown on the secure payment page. We never see or store your card details.

## Returns

### Can I return an item?
Please read our [Returns & Refunds Policy](/returns-policy) for eligibility and the process.$md$),

('shipping-policy', 'Shipping Policy', 'How delivery works for orders within Nigeria and internationally.',
$md$## Delivery destinations

We deliver to destinations within Nigeria and to international destinations that are enabled at checkout. If a destination is not supported, you will be told before payment and will not be charged.

## Delivery fees

Delivery fees are calculated at checkout based on your delivery address and the delivery method you select. The fee shown at checkout is the fee you pay.

## Delivery times

Where an estimated delivery window is available for your destination, it is shown at checkout. Estimates begin once your order has been dispatched and are not guaranteed. [Add your processing/dispatch time, e.g. "Orders are processed within X business days."]

## Supplier dispatch

Some items are dispatched by our supplier partners. Items in a single order may arrive in separate parcels.

## International orders

International orders may be subject to import duties, taxes or customs fees charged by the destination country. These are not included in your order total and are payable by the recipient unless stated otherwise at checkout. [Confirm with your courier.]

## Tracking

When your order is dispatched, tracking information (where available) is added to your order and can be viewed on the [Track Order](/track-order) page.

## Questions

Contact us at [support email] with your order number.$md$),

('returns-policy', 'Returns & Refunds Policy', 'Our process for returns, exchanges and refunds.',
$md$## Eligibility

[State your return window, e.g. "Items can be returned within X days of delivery."] Items must be unworn, unwashed and returned with original tags and packaging.

## Non-returnable items

[List any items that cannot be returned, e.g. earrings or items marked final sale.]

## How to start a return

1. Contact us at [support email] with your order number and the item(s) you want to return.
2. We will confirm whether the item is eligible and share return instructions.
3. Send the item back using the instructions provided. [State who pays return shipping.]

## Refunds

Once your return is received and inspected, we will let you know whether the refund has been approved. Approved refunds are issued to the original payment method. [State your refund processing time.] The time it takes for the refund to appear depends on your bank or card provider.

## Damaged or incorrect items

If your item arrives damaged or incorrect, contact us within [X days] of delivery with your order number and photos so we can resolve it.

## Delivery fees and duties

[State whether original delivery fees, customs duties or taxes are refundable.]$md$),

('privacy-policy', 'Privacy Policy', 'How we collect, use and protect your personal information.',
$md$## Who we are

Attitude Collections ("we", "us") operates this website. [Add your registered business name and contact address.]

## Information we collect

- **Account and order details:** name, email address, phone number and delivery address.
- **Payment information:** payments are processed by our payment provider. We do not receive or store your full card details.
- **Usage information:** basic technical information needed to run the website securely, such as session cookies.

## How we use your information

- To process, deliver and support your orders
- To create and manage your account
- To respond to messages you send us
- To send marketing emails, only if you subscribe (you can unsubscribe at any time)
- To prevent fraud and keep the website secure

## Sharing your information

We share only the information needed to fulfil your order with delivery partners, supplier partners who dispatch your items, and our payment provider. We do not sell your personal information.

## Cookies

We use essential cookies to keep you signed in and to remember your shopping bag.

## Your rights

You may request access to, correction of, or deletion of your personal information by contacting [support email]. [Add any rights that apply under the Nigeria Data Protection Act 2023 or other applicable law, reviewed by a qualified adviser.]

## Changes

We may update this policy from time to time. The latest version will always be available on this page.$md$),

('terms', 'Terms & Conditions', 'The terms that apply when you use this website and place an order.',
$md$## About these terms

These terms apply to your use of the Attitude Collections website and to any order you place. [Add your registered business name and details.]

## Products and pricing

We make every effort to display products, colours and prices accurately. Prices are shown in Nigerian Naira (NGN) unless stated otherwise. The total you pay, including delivery and any applicable charges, is shown at checkout before payment.

## Orders

Your order is confirmed once payment has been verified. We may cancel an order and issue a full refund if an item becomes unavailable or a pricing error occurs.

## Delivery

Delivery is governed by our [Shipping Policy](/shipping-policy).

## Returns

Returns and refunds are governed by our [Returns & Refunds Policy](/returns-policy).

## Accounts

You are responsible for keeping your account password secure.

## Governing law

[State the governing law and jurisdiction, reviewed by a qualified adviser.]

## Contact

Questions about these terms can be sent to [support email].$md$);
