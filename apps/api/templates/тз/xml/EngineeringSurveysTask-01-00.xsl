<?xml version="1.0" encoding="UTF-8"?>


<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="html" media-type="text/html" encoding="UTF-8" omit-xml-declaration="yes" />

	<xsl:template match="/">
		<xsl:apply-templates select="Document"/>
	</xsl:template>

	<xsl:key name="DocumentsInfoById" match="//DocumentInfo" use="@Id"/>

	<xsl:template match="Document">
		<html>
			<head>
				<title>
					<xsl:value-of select="Requisites/Number"/>
				</title>
				<style type="text/css">
					@page { size: A4; margin: 20mm; }
					body {
					    font-family: Times New Roman;
					    font-size: 15px;
					    width: auto;
					    margin: 0;
					    text-align: left;
					}
					table {
					    border-collapse: collapse;
					    margin: 0.5em 0;
					    width: 100%;
					}
					td,
					th {
					    border: 1px solid black;
					    padding: 0.2em 0.4em;
					    overflow-wrap: anywhere;
					}
					thead tr,
					tfoot tr {
					    font-weight: bold;
					    text-align: center;
					    color: #444;
					}
					td a {
					    display: block;
					}
					td.title {
					    border: 1px dashed black;
					    text-align: center;
					    padding: 1em;
					}
					td.borderdot {
					    border: 1px dashed black;
					}
					.not-border {
					    border: 0;
					}
					p {
					    padding: 0.2em 0;
					    margin: auto;
					    color: black;
					}
					p.border {
					    border: 1px solid #bbb;
					    padding: 0.4em;
					    margin: 0.4em 0;
					}
					p.under-text {
					    border-top: 1px solid #bbb;
					    color: #555;
					    padding: 0;
					    margin: 0;
					}
					b {
					    color: #444;
					}
					h1 {
					    font-size: 18px;
					    font-weight: bold;
					    text-align: center;
					    padding: 0.5em;
					    margin-top: 2em;
					}
					h2 {
					    font-size: 17px;
					    font-weight: bold;
					    text-align: left;
					    padding: 0.5em;
					    margin-top: 2em;
					}
					h3 {
					    font-size: 16px;
					    font-weight: bold;
					    text-align: left;
					    padding: 0.5em;
					    margin-top: 1em;
					}
					h4 {
					    font-size: 15px;
					    font-weight: bold;
					    text-align: left;
					}
					h5 {
					    font-size: 15px;
					    font-weight: bold;
					    margin: 1em 0em;
					    text-align: center;
					    color: #333;
					}
					.bckgr {
					    background-color: #ddd;
					}
					.upper {
					    text-transform: uppercase;
					}
					.lower {
					    text-transform: lowercase;
					}
					
					.margin-top-small {
					    margin-top: 1em;
					}
					.margin-bottom-small {
					    margin-bottom: 2em;
					}
					a {
					    color: black;
					    text-decoration: none;
					}
					.clear {
					    margin-bottom: 0;
					    margin-top: 3em;
					    padding: 0;
					}
					.left {
					    text-align: left;
					}
					.right {
					    text-align: right;
					}
					.justify {
					    text-align: justify;
					}
					.center {
					    text-align: center;
					}
					.bold {
					    font-weight: bold;
					    color: #444;
					}
					.under {
					    text-decoration: underline;
					}
					.italic {
					    font-style: italic;
					}
					img {
					    max-width: 100%;
					    margin: 0.5em 0;
					}
					i {
					    padding-right: 5px;
					    font-style: normal;
					}</style>
			</head>
			<body>
				<xsl:call-template name="TitleSection"/>

				<xsl:call-template name="Modifications"/>

				<xsl:call-template name="Authors"/>

				<xsl:call-template name="ChaptersSection"/>

				<xsl:call-template name="ObjectInfo"/>

				<xsl:call-template name="DecisionDocuments"/>
				
				<xsl:call-template name="EngineeringSurveyTimePeriod"/>

				<xsl:call-template name="Developers"/>

				<xsl:call-template name="TechnicalCustomer"/>

				<xsl:call-template name="Researchers"/>

				<xsl:call-template name="Purposes"/>

				<xsl:call-template name="Tasks"/>

				<xsl:call-template name="EngineeringSurveyTypes"/>

				<xsl:call-template name="TechnogenicImpacts"/>

				<xsl:call-template name="Ecology"/>

				<xsl:call-template name="BoundariesArealLinear"/>

				<xsl:call-template name="DangerousNaturalProcessesSoils"/>

				<xsl:call-template name="Requirements"/>

				<xsl:call-template name="AvailableDocuments"/>

			</body>
		</html>
	</xsl:template>
	<!-- Конец основного шаблона -->

	<xsl:template name="TitleSection">
		<table>
			<tr>
				<td colspan="2" class="not-border">
					<br/>
				</td>
			</tr>
			<tr valign="top">
				<td class="not-border" width="50%">
					<p><b>УТВЕРЖДЕНО:</b></p><br/>
					<xsl:for-each select="//Requisites/Authors/Author//*[@FunctionalRole = 'Утверждено']">
						<xsl:if test="name() = 'Representative'">
							<p><xsl:value-of select="Position"/></p>
							<p><xsl:value-of select="../../Organization/FullName"/></p>
							<p><b>
									<i><xsl:value-of select="Surname"/></i><xsl:text> </xsl:text>
									<i><xsl:value-of select="Name"/></i><xsl:if test="Patronymic"><xsl:text> </xsl:text></xsl:if>
									<xsl:value-of select="Patronymic"/>
								</b></p>
						</xsl:if>
						<xsl:if test="name() = 'IndividualEntrepreneur'">
							<p class="upper">индивидуальный предприниматель</p>
							<p class="upper">ОГРНИП: <xsl:value-of select="OGRNIP"/></p>
							<p><b>
									<i><xsl:value-of select="Surname"/></i><xsl:text> </xsl:text>
									<i><xsl:value-of select="Name"/></i><xsl:if test="Patronymic"><xsl:text> </xsl:text></xsl:if>
									<xsl:value-of select="Patronymic"/>
								</b></p>
						</xsl:if>
						<xsl:if test="name() = 'Person'">
							<p class="upper">физическое лицо</p>
							<p class="upper">СНИЛС: <xsl:value-of select="SNILS"/></p>
							<p><b>
									<i><xsl:value-of select="Surname"/></i><xsl:text> </xsl:text>
									<i><xsl:value-of select="Name"/></i><xsl:if test="Patronymic"><xsl:text> </xsl:text></xsl:if>
									<xsl:value-of select="Patronymic"/>
								</b></p>
						</xsl:if>
					</xsl:for-each>
				</td>
				<td class="justify not-border">
					<p class="upper"><xsl:apply-templates select="//Requisites/SecurityLabel"/></p>
				</td>
			</tr>
			<tr>
				<td colspan="2" class="not-border">
					<br/>
				</td>
			</tr>
			<tr>
				<td class="title" colspan="2">
					<h1 class="upper">Задание на выполнение инженерных изысканий</h1>
					<xsl:if test="//BasicEngineeringSurvey | //SpecialEngineeringSurvey">

						<h1 class="lower">( <xsl:for-each select="//BasicEngineeringSurvey | //SpecialEngineeringSurvey">
								<xsl:if test="name() = 'BasicEngineeringSurvey'">
									<xsl:call-template name="SurveyTypeList">
										<xsl:with-param name="Code" select="./BasicEngineeringSurveyType"/>
									</xsl:call-template>
								</xsl:if>
								<xsl:if test="name() = 'SpecialEngineeringSurvey'">
									<xsl:call-template name="SurveyTypeList">
										<xsl:with-param name="Code" select="./SpecialEngineeringSurveyType"/>
									</xsl:call-template>
								</xsl:if>
								<xsl:if test="position() != last()">, </xsl:if>
							</xsl:for-each> )</h1>
					</xsl:if>


					<xsl:if test="/Document/Requisites/Number">
						<h2 class="center">№ <xsl:value-of select="/Document/Requisites/Number"/></h2>
					</xsl:if>
					<h2 class="center upper clear">
						<xsl:value-of select="/Document/Content/ObjectInfo/OKS/*/Name"/>
					</h2>
					<p class="under-text">наименование объекта капитального строительства (далее - объект)</p>

					<xsl:if test="/Document/Content/ObjectInfo/OKS/*/Placement/Address">
						<h2 class="center clear">
							<xsl:apply-templates select="/Document/Content/ObjectInfo/OKS/*/Placement/Address"/>
						</h2>
						<p class="under-text">адрес (местоположение) объекта</p>
					</xsl:if>
					<xsl:if test="/Document/Content/Object/BeginAddress">
						<h2 class="center clear">
							<xsl:apply-templates select="/Document/Content/Object/BeginAddress"/>
						</h2>
						<p class="under-text">Адрес (местоположение) начального пункта линейного объекта</p>
						<h2 class="center clear">
							<xsl:apply-templates select="/Document/Content/Object/FinalAddress"/>
						</h2>
						<p class="under-text">Адрес (местоположение) конечного пункта линейного объекта</p>
					</xsl:if>

					<h2 class="center clear">
						<xsl:if test="//ObjectInfo/LinearObject">линейный</xsl:if>
						<xsl:if test="//ObjectInfo/ArealObject">площадной</xsl:if>
					</h2>
					<p class="under-text">вид объекта</p>

					<h2 class="center clear">
						<xsl:value-of select="/Document/Content/ConstructionType"/>
					</h2>
					<p class="under-text">вид градостроительной деятельности</p>

					<h2 class="center clear">
						<xsl:apply-templates select="/Document/Content/EngineeringSurveyStage"/>
					</h2>
					<p class="under-text">этап изысканий</p>

					<br/>
					<br/>
					<p class="right upper">Версия документа: <b><xsl:value-of select="/Document/@VersionNumber"/></b></p>
				</td>
			</tr>
		</table>
		<p class="center">
			<xsl:value-of select="substring(/Document/Requisites/Date, 1, 4)"/>
		</p>
	</xsl:template>

	<xsl:template name="Modifications">
		<a name="chMod"/>
		<h2 class="bckgr upper center">Сведения о внесении изменений<br/>в задание на выполнение инженерных изысканий</h2>
		<xsl:if test="/Document/Versions">
			<table>
				<thead>
					<tr><td colspan="2" width="40%">Предыдущие версии документа</td><td rowspan="2" width="60%">Сведения о внесенных изменениях</td></tr>
					<tr><td width="20%">Порядковый номер версии</td><td width="20%">Контрольная сумма файла версии документа</td></tr>	
				</thead>
				<tbody>
					<xsl:for-each select="/Document/Versions/Version">
						<xsl:sort select="@VersionNumber"/>
						<tr>
							<td class="center"><xsl:value-of select="@VersionNumber"/></td>
							<td class="center"><xsl:value-of select="@Checksum"/></td>
							<td><xsl:call-template name="StringReplace"><xsl:with-param name="input" select="Modification"></xsl:with-param></xsl:call-template></td>
						</tr>
					</xsl:for-each>
					<xsl:if test="not(/Document/Versions)">
						<tr>
							<td colspan="2">отсутствуют</td>
							<td><b><xsl:value-of select="/Document/@VersionNumber"/></b></td>
						</tr>
					</xsl:if>
				</tbody>
			</table>
		</xsl:if>
		<xsl:if test="not(/Document/Versions)">
			<p>Изменения в документ не вносились.</p>
		</xsl:if>
	</xsl:template>

	<xsl:template name="Authors">
		<a name="chAuthors"/>
		<h2 class="bckgr upper center">лист согласования задания на проведение изысканий</h2>
		
		<xsl:for-each select="/Document/Requisites/Authors/Author">
			
			<xsl:if test="Organization">
				<p class="center bold margin-top-small upper">
					<xsl:if test="Organization[RAFP]">Представительство (филиал) иностранного юридического лица</xsl:if>
					<xsl:if test="Organization[OGRN]">Юридическое лицо</xsl:if>
				</p>
				<xsl:apply-templates select="Organization"/>
				<xsl:for-each select="Representatives/Representative">
					<xsl:sort select="@FunctionalRole"/>
					<b><xsl:call-template name="FunctionalRolesList">
						<xsl:with-param name="Code"><xsl:value-of select="@FunctionalRole"/></xsl:with-param>
					</xsl:call-template>:</b>
					<table>
						<tr>
							<td style="width:25%">Должность:</td>
							<td>
								<xsl:value-of select="Position"/>
							</td>
						</tr>
						<tr>
							<td>Фамилия:</td>
							<td>
								<xsl:value-of select="Surname"/>
							</td>
						</tr>
						<tr>
							<td>Имя:</td>
							<td>
								<xsl:value-of select="Name"/>
							</td>
						</tr>
						<xsl:if test="Patronymic">
							<tr>
								<td>Отчество:</td>
								<td>
									<xsl:value-of select="Patronymic"/>
								</td>
							</tr>
						</xsl:if>
						<xsl:if test="Email">
							<tr><td>Адрес электронной почты:</td><td><xsl:value-of select="Email"/></td></tr>
						</xsl:if>
					</table>
				</xsl:for-each>
			</xsl:if>
			
			<xsl:if test="IndividualEntrepreneur[@FunctionalRole != 'Утверждено']">
				<p class="center bold margin-top-small upper">Индивидуальный предприниматель</p>
				<b><xsl:call-template name="FunctionalRolesList">
					<xsl:with-param name="Code"><xsl:value-of select="IndividualEntrepreneur/@FunctionalRole"/></xsl:with-param>
				</xsl:call-template>:</b>
				<xsl:apply-templates select="IndividualEntrepreneur"/>
			</xsl:if>
			
			<xsl:if test="Person[@FunctionalRole != 'Утверждено']">
				<p class="center bold margin-top-small upper">Физическое лицо</p>
				<b><xsl:call-template name="FunctionalRolesList">
					<xsl:with-param name="Code"><xsl:value-of select="Person/@FunctionalRole"/></xsl:with-param>
				</xsl:call-template>:</b>
				<xsl:apply-templates select="Person"/>
			</xsl:if>
		</xsl:for-each>
		
	</xsl:template>
	
	<xsl:template name="ChaptersSection">
		<h2 class="bckgr upper center">Состав задания на выполнение инженерных изысканий</h2>

		<table id="chapterstable">
			<tr class="bold center">
				<td width="5%">№ <nobr>п/п</nobr></td>
				<td>Наименование раздела</td>
			</tr>
			<tr>
				<td> </td>
				<td>
					<a href="#chMod">Сведения о внесении изменений в задание на выполнение инженерных изысканий</a>
				</td>
			</tr>
			<tr>
				<td> </td>
				<td>
					<a href="#chAuthors">Сведения о лице, подготовившем задание на выполнение инженерных изысканий</a>
				</td>
			</tr>
			<tr>
				<td>1.</td>
				<td>
					<a href="#ch1">Сведения об объекте</a>
				</td>
			</tr>
			<tr>
				<td>2.</td>
				<td>
					<a href="#ch2">Документы-основание для выполнения работ</a>
				</td>
			</tr>
			<tr>
				<td>2.1.</td>
				<td>
					<a href="#ch2-1">Сведения о сроках выполнения работ по инженерным изысканиям, проектирования и эксплуатации объект</a>
				</td>
			</tr>
			<tr>
				<td>3.</td>
				<td>
					<a href="#ch3">Застройщик</a>
				</td>
			</tr>
			<tr>
				<td>4.</td>
				<td>
					<a href="#ch4">Технический заказчик</a>
				</td>
			</tr>
			<tr>
				<td>5.</td>
				<td>
					<a href="#ch5">Сведения о лица, заключивших договор на выполнение инженерных изысканий</a>
				</td>
			</tr>
			<tr>
				<td>6.</td>
				<td>
					<a href="#ch6">Цели инженерных изысканий</a>
				</td>
			</tr>
			<tr>
				<td>7.</td>
				<td>
					<a href="#ch7">Задачи инженерных изысканий</a>
				</td>
			</tr>
			<tr>
				<td>8.</td>
				<td>
					<a href="#ch8">Виды необходимых изысканий</a>
				</td>
			</tr>
			<tr>
				<td>9.</td>
				<td>
					<a href="#ch9">Предполагаемые техногенные воздействия объекта на окружающую среду</a>
				</td>
			</tr>
			<tr>
				<td>10.</td>
				<td>
					<a href="#ch10">Описание экологической обстановки</a>
				</td>
			</tr>
			<tr>
				<td>11.</td>
				<td>
					<a href="#ch11">Данные о границах площадки (площадок) и (или) трассы (трасс) линейного сооружения (точки ее начала и окончания, протяженность)</a>
				</td>
			</tr>
			<tr>
				<td>12.</td>
				<td>
					<a href="#ch12">Наличие предполагаемых опасных природных процессов и явлений, многолетнемерзлых и специфических грунтов на территории расположения объекта</a>
				</td>
			</tr>
			<tr>
				<td>13.</td>
				<td>
					<a href="#ch13">Требования к выполнению изысканий</a>
				</td>
			</tr>
			<tr>
				<td>14.</td>
				<td>
					<a href="#ch14">Документы, прилагаемые к заданию на выполнение инженерных изысканий</a>
				</td>
			</tr>
		</table>
	</xsl:template>

	<xsl:template name="ObjectInfo">
		<a name="ch1"/>
		<h2 class="bckgr upper center">Сведения об объекте</h2>

		<xsl:if test="//ObjectInfo/ArealObject">
			<p>Вид объекта: площадной</p>
			<xsl:call-template name="ArealObject"/>
		</xsl:if>

		<xsl:if test="//ObjectInfo/LinearObject">
			<p>Вид объекта: линейный</p>
			<xsl:call-template name="LinearObject"/>
		</xsl:if>

		<xsl:if test="//ObjectInfo/OKS">
			<xsl:apply-templates select="//ObjectInfo/OKS"/>
		</xsl:if>

		<xsl:if test="//ObjectInfo/ComplexObject">
			<xsl:apply-templates select="//ObjectInfo/ComplexObject"/>
		</xsl:if>

	</xsl:template>

	<xsl:template name="ArealObject">
		<p>Размеры площадки по генплану: <xsl:apply-templates select="//ObjectInfo/ArealObject/PlanSize"/></p>
		<p>Масштаб съемки: <xsl:value-of select="//ObjectInfo/ArealObject/ShootingScale"/></p>
		<p>Сечение рельефа, м: <xsl:value-of select="//ObjectInfo/ArealObject/SectionRelief"/></p>
		<xsl:if test="//ObjectInfo/ArealObject/AdditionalRequirements">
			<p>Дополнительные или особые требования:</p>
			<xsl:call-template name="TextBlockInTable">
				<xsl:with-param name="obj" select="//ObjectInfo/ArealObject/AdditionalRequirements"/>
			</xsl:call-template>
		</xsl:if>
	</xsl:template>

	<xsl:template name="LinearObject">
		<p>Протяженность: <xsl:value-of select="//ObjectInfo/LinearObject/Length"/></p>
		<p>Ширина полосы съемки, м: <xsl:value-of select="//ObjectInfo/LinearObject/ShootingWidth"/></p>
		<p>Масштаб съемки: <xsl:value-of select="//ObjectInfo/LinearObject/ShootingScale"/></p>
		<p>Масштаб плана профиля: <xsl:value-of select="//ObjectInfo/LinearObject/ScalePlanProfile"/></p>
		<p>Сечение рельефа, м: <xsl:value-of select="//ObjectInfo/LinearObject/SectionRelief"/></p>
		<xsl:if test="//ObjectInfo/LinearObject/AdditionalRequirements">
			<p>Дополнительные или особые требования:</p>
			<xsl:call-template name="TextBlockInTable">
				<xsl:with-param name="obj" select="//ObjectInfo/LinearObject/AdditionalRequirements"/>
			</xsl:call-template>
		</xsl:if>
	</xsl:template>

	<xsl:template match="OKS">
		<h3>Объект капитального строительства: <xsl:value-of select="ArealOKS/Name | LinearOKS/Name"/></h3>

		<p>Идентификатор объекта: <xsl:value-of select="@ObjectID"/></p>
		<p>Статус объекта: <xsl:value-of select="@ObjectStatus"/></p>
		<xsl:if test="ArealOKS">
			<xsl:call-template name="ArealOKS">
				<xsl:with-param name="obj" select="ArealOKS"/>
			</xsl:call-template>
		</xsl:if>

		<xsl:if test="LinearOKS">
			<xsl:call-template name="LinearOKS">
				<xsl:with-param name="obj" select="LinearOKS"/>
			</xsl:call-template>
		</xsl:if>

	</xsl:template>

	<xsl:template name="ArealOKS">
		<xsl:param name="obj"/>

		<p>Местоположение объекта:</p>
		<xsl:apply-templates select="$obj/Placement"/>

		<p>Код классификатора функционального назначения объектов капитального строительства: <xsl:value-of select="$obj/FunctionsClass"/></p>
		<p>Уровень ответственности: <xsl:value-of select="$obj/ResponsibilityLevel"/></p>
		<p>Сведения о классе энергетической эффективности (в случае, если присвоение класса энергетической эффективности объекту капитального строительства является обязательным в соответствии с законодательством Российской Федерации об энергосбережении) и о повышении энергетической эффективности: <xsl:value-of select="$obj/EnergyEfficiency"/></p>
		<p>Класс опасности опасного производственного объекта: <xsl:value-of select="$obj/DangerousIndustrialObject"/></p>
		<p>Категория пожарной и взрывопожарной опасности: <xsl:value-of select="$obj/FireDangerCategory"/></p>
		<p>Принадлежность к объектам транспортной инфраструктуры и к другим объектам, функционально-технологические особенности которых влияют на их безопасность: 
		<xsl:call-template name="StringReplace">
			<xsl:with-param name="input" select="$obj/FunctionsFeatures"/>
		</xsl:call-template>

		</p>
		<p>Сведения о наличии помещений с постоянным пребыванием людей:</p>
		<xsl:call-template name="StringReplace">
			<xsl:with-param name="input" select="$obj/PeoplePermanentStay"/>
		</xsl:call-template>

		<p>Конструктивные особенности:</p>
		<xsl:call-template name="TextBlockInTable">
			<xsl:with-param name="obj" select="$obj/DesignFeatures"/>
		</xsl:call-template>

		<br/>
		<p>Размеры по генплану: <xsl:apply-templates select="$obj/PlanSize"/></p>
		<p>Общая высота, м: <xsl:value-of select="$obj/OverallHeight"/></p>
		<p>Количество этажей: <xsl:value-of select="$obj/NumberFloors"/></p>
		<p>Глубина подвального помещения: <xsl:value-of select="$obj/Basement"/></p>
		<p>Ориентировочная масса, Т: <xsl:value-of select="$obj/ApproximateWeight"/></p>
		<br/>
		<xsl:apply-templates select="$obj/Foundation"/>
		<br/>
		<xsl:apply-templates select="$obj/FoundationPit"/>
		<p>Глубина ведения земляных работ (м): <xsl:value-of select="$obj/EarthworksDepth"/></p>
		<p>Сведения о глубине сжимаемой толщи грунтов (м): <xsl:value-of select="$obj/CompressibleSoilThickness"/></p>
		<p>Сведения о конструкциях, расположенных ниже основного фундамента: </p>
		<xsl:call-template name="TextBlockInTable">
			<xsl:with-param name="obj" select="$obj/StructuresBelowFoundation"/>
		</xsl:call-template>

		<p>Предполагаемые статические и динамические нагрузки: </p>
		<xsl:call-template name="TextBlockInTable">
			<xsl:with-param name="obj" select="$obj/Loads"/>
		</xsl:call-template>

		<p>Допустимая осадка проектируемых зданий и сооружений, см: <xsl:value-of select="$obj/PermissibleDraft"/></p>

	</xsl:template>

	<xsl:template name="LinearOKS">
		<xsl:param name="obj"/>

		<p>Местоположение объекта:</p>
		<xsl:apply-templates select="$obj/Placement"/>

		<p>Код классификатора функционального назначения объектов капитального строительства: <xsl:value-of select="$obj/FunctionsClass"/></p>
		<p>Уровень ответственности: <xsl:value-of select="$obj/ResponsibilityLevel"/></p>
		<p>Протяженность: <xsl:value-of select="$obj/Length"/></p>

		<xsl:apply-templates select="$obj/LinePower | $obj/LineCommunication | $obj/Pipeline | $obj/AutomobileRoad | $obj/LineRailway | $obj/Bridge"/>

	</xsl:template>

	<xsl:template match="LinePower">
		<h3>Линия электропередачи</h3>
		<p>Тип Фундамента: <xsl:for-each select="FoundationType">
				<xsl:value-of select="."/>
				<xsl:if test="position() != last()">, </xsl:if>
			</xsl:for-each>
		</p>
		<xsl:if test="FoundationMaterial">
			<p>Материал Фундамента: <xsl:value-of select="FoundationMaterial"/></p>
		</xsl:if>
		<xsl:if test="CombinedFoundationMaterial">
			<p>Материалы Фундамента (комбинированный): <xsl:for-each select="CombinedFoundationMaterial/Material">
					<xsl:value-of select="."/>
					<xsl:if test="position() != last()">, </xsl:if>
				</xsl:for-each>
			</p>
		</xsl:if>
		<p>Глубина заложения фундамента, м: <xsl:value-of select="FoundationDepth"/></p>
	</xsl:template>

	<xsl:template match="LineCommunication">
		<h3>Линия связи</h3>
		<p>Способ прокладки: <xsl:value-of select="LayingMethod"/></p>
		<p>Материал кабеля: <xsl:value-of select="MaterialCable"/></p>
		<p>Глубина заложения кабеля, м: <xsl:value-of select="CableDepth"/></p>
		<p>Тип Фундамента: <xsl:for-each select="FoundationType">
				<xsl:value-of select="."/>
				<xsl:if test="position() != last()">, </xsl:if>
			</xsl:for-each>
		</p>
		<xsl:if test="FoundationMaterial">
			<p>Материал Фундамента: <xsl:value-of select="FoundationMaterial"/></p>
		</xsl:if>
		<xsl:if test="CombinedFoundationMaterial">
			<p>Материалы Фундамента (комбинированный): <xsl:for-each select="CombinedFoundationMaterial/Material">
					<xsl:value-of select="."/>
					<xsl:if test="position() != last()">, </xsl:if>
				</xsl:for-each>
			</p>
		</xsl:if>
		<p>Глубина заложения фундамента, м: <xsl:value-of select="FoundationDepth"/></p>
	</xsl:template>

	<xsl:template match="Pipeline">
		<h3>Трубопровод</h3>
		<p>Способ прокладки: <xsl:value-of select="LayingMethod"/></p>
		<p>Материал труб: <xsl:value-of select="MaterialPipe"/></p>
		<p>Глубина заложения трубы, м: <xsl:value-of select="PipeDepth"/></p>
		<p>Диаметр труб Dу, мм: <xsl:value-of select="PipeDiameter"/></p>
		<p>Давление Pу, МПа: <xsl:value-of select="Pressure"/></p>
	</xsl:template>

	<xsl:template match="AutomobileRoad">
		<h3>Автомобильная дорога</h3>
		<p>Высота насыпи, м: <xsl:value-of select="EmbankmentHeight"/></p>
	</xsl:template>

	<xsl:template match="LineRailway">
		<h3>Железнодорожная линия</h3>
		<p>Высота насыпи, м: <xsl:value-of select="EmbankmentHeight"/></p>
		<p>Материал шпал: <xsl:value-of select="SleepersMaterial"/></p>
	</xsl:template>

	<xsl:template match="Bridge">
		<h3>Мост</h3>
		<p>Тип Фундамента: <xsl:for-each select="FoundationType">
				<xsl:value-of select="."/>
				<xsl:if test="position() != last()">, </xsl:if>
			</xsl:for-each>
		</p>
		<xsl:if test="FoundationMaterial">
			<p>Материал Фундамента: <xsl:value-of select="FoundationMaterial"/></p>
		</xsl:if>
		<xsl:if test="CombinedFoundationMaterial">
			<p>Материалы Фундамента (комбинированный): <xsl:for-each select="CombinedFoundationMaterial/Material">
					<xsl:value-of select="."/>
					<xsl:if test="position() != last()">, </xsl:if>
				</xsl:for-each>
			</p>
		</xsl:if>
		<p>Глубина заложения фундамента, м: <xsl:value-of select="FoundationDepth"/></p>
	</xsl:template>

	<xsl:template match="Foundation">
		<p>Сведения о фундаменте:</p>
		<p>Тип Фундамента: <xsl:for-each select="Type"><xsl:value-of select="."/>
				<xsl:if test="position() != last()">, </xsl:if>
			</xsl:for-each>
		</p>
		<xsl:if test="SingleMaterial">
			<p>Материал Фундамента: <xsl:value-of select="SingleMaterial"/></p>
		</xsl:if>
		<xsl:if test="CombinedMaterial">
			<p>Материалы Фундамента (комбинированный): <xsl:for-each select="CombinedMaterial/Material">
					<xsl:value-of select="."/>
					<xsl:if test="position() != last()">, </xsl:if>
				</xsl:for-each>
			</p>
		</xsl:if>
		<p>Размер: <xsl:value-of select="Size"/></p>
		<p>Сведения о сечении свай, мм: <xsl:value-of select="PilesCross"/></p>
		<p>Глубина заложения фундамента, м: <xsl:value-of select="Depth"/></p>
		<p>Сведения о нагрузке на фундамент:</p>
		<p>Нагрузка на одну сваю (куст свай), кН: <xsl:value-of select="Load/PileLoad"/></p>
		<p>Нагрузка на 1 погонный метр длины ленточного фундамента, кН/м2: <xsl:value-of select="Load/StripLoad"/></p>
		<p>Предполагаемая нагрузка на грунты, кН/м2: <xsl:value-of select="Load/SoilLoad"/></p>
	</xsl:template>

	<xsl:template match="FoundationPit">
		<p>Сведения о котловане:</p>
		<p>Глубина котлована (м): <xsl:value-of select="Depth"/></p>
		<p>Ограждение котлована: <xsl:value-of select="Fence"/></p>
	</xsl:template>

	<xsl:template match="ComplexObject">
		<table>
			<tr>
				<td>
					<h3>Сложный (составной) объект: <xsl:value-of select="Name"/></h3>
					<p>Идентификатор объекта: <xsl:value-of select="@ObjectID"/></p>
					<p>Статус объекта: <xsl:value-of select="@ObjectStatus"/></p>
					<p>Местоположение объекта:</p>
					<xsl:apply-templates select="Placement"/>
					<p>Код классификатора функционального назначения объектов капитального строительства: <xsl:value-of select="FunctionsClass"/></p>
					<p>Уровень ответственности: <xsl:value-of select="ResponsibilityLevel"/></p>
					<p>Класс опасности опасного производственного объекта: <xsl:value-of select="DangerousIndustrialObject"/></p>
					<p>Принадлежность к объектам транспортной инфраструктуры и к другим объектам, функционально-технологические особенности которых влияют на их безопасность: 
					<xsl:call-template name="StringReplace">
						<xsl:with-param name="input" select="FunctionsFeatures"/>
					</xsl:call-template>

					</p>
					<br/>
					<p>В состав объекта входят: </p>
					<br/>
					<xsl:for-each select="ObjectParts/ComplexObject">
						<xsl:apply-templates select="."/>
					</xsl:for-each>

					<xsl:for-each select="ObjectParts/OKS">
						<xsl:apply-templates select="."/>
						<xsl:if test="position() != last()">
							<hr/>
						</xsl:if>
					</xsl:for-each>
				</td>
			</tr>
		</table>
	</xsl:template>

	<xsl:template match="PlanSize">
		<xsl:value-of select="Width"/> (Ш) * <xsl:value-of select="Length"/> (Д) <xsl:if test="Height"> * <xsl:value-of select="Height"/> (В)</xsl:if>
	</xsl:template>

	<xsl:template name="UsedNorms">
		<xsl:if test="count(//Requirements/UsedNorms/UsedNorm) = 0">
			<p>Не регламентируется.</p>
		</xsl:if>
		<xsl:if test="count(//Requirements/UsedNorms/UsedNorm) != 0">
			<xsl:for-each select="//Requirements/UsedNorms/UsedNorm">
				<p>
					<xsl:number value="position()" format="1. "/>
					<xsl:value-of select="."/>
				</p>
			</xsl:for-each>
		</xsl:if>
	</xsl:template>
	
	<xsl:template name="DecisionDocuments">
		<a name="ch2"/>
		<h3 class="bckgr upper">2. Документы-основание для выполнения работ</h3>
		
		<table>
			<xsl:if test="count(//SurveysInitiationDocuments/DocumentInfo[File]) > 0">
				<thead>
					<tr>
						<th width="5%">№ п/п</th>
						<th width="65%">Наименование и реквизиты документа</th>
						<th width="25%">Наименование<br/>файла документа<br/>(подписи к файлу)</th>
						<th>Контрольная сумма файла</th>
					</tr>
				</thead>
			</xsl:if>
			<tbody>
				<xsl:for-each select="//SurveysInitiationDocuments/DocumentInfo">
					<xsl:sort select="@Type"/>
					<xsl:call-template name="DocumentFilesTable"/>
				</xsl:for-each>
			</tbody>
		</table>
		
		<xsl:if test="/Document/Content/SurveysInitiationDocuments/Note">
			<p class="upper">Дополнительные сведения:</p>
			<table>
				<tr>
					<td>
						<xsl:value-of select="//SurveysInitiationDocuments/Note"/>
					</td>
				</tr>
			</table>
		</xsl:if>
		
	</xsl:template>
	
	<xsl:template name="EngineeringSurveyTimePeriod">
		<a name="ch2-1"/>
		<h3 class="bckgr upper">2.1. Сведения о сроках выполнения работ по инженерным изысканиям, проектирования и эксплуатации объекта</h3>
			<xsl:call-template name="StringReplace">
			<xsl:with-param name="input" select="//EngineeringSurveyTimePeriod"/>
		</xsl:call-template>
		
	</xsl:template>
	
	<xsl:template name="Developers">
		<a name="ch3"/>
		<h3 class="bckgr upper">3. Застройщик</h3>
		
		<xsl:for-each select="/Document/Content/Developer/*">
			<xsl:apply-templates select=".">
				<xsl:with-param name="ShowType" select="1"/>
			</xsl:apply-templates>
		</xsl:for-each>
		
		<xsl:if test="not(/Document/Content/Developer)">
			<table>
				<tr>
					<td>Отсутствует</td>
				</tr>
			</table>
		</xsl:if>
		
	</xsl:template>
	
	<xsl:template name="TechnicalCustomer">
		<a name="ch4"/>
		<h3 class="bckgr upper">4. Технический заказчик</h3>
		
		<xsl:for-each select="/Document/Content/TechnicalCustomer">
			<xsl:apply-templates select="Organization">
				<xsl:with-param name="ShowType" select="1"/>
			</xsl:apply-templates>
		</xsl:for-each>
		
		<xsl:if test="not(/Document/Content/TechnicalCustomer)">
			<table>
				<tr>
					<td>Отсутствует</td>
				</tr>
			</table>
		</xsl:if>
	</xsl:template>
	
	<xsl:template name="Researchers">
		<a name="ch5"/>
		<h3 class="bckgr upper">5. Сведения о лицах, заключивших договор на выполнение инженерных изысканий</h3>
		<xsl:if test="not(//Researchers)">
			<p>Сведения не представлены.</p>
		</xsl:if>
		<xsl:if test="//Researchers">
			<xsl:for-each select="//Researchers/Researcher">
				<p><xsl:number value="position()" format="1. "/>Договор № <xsl:value-of select="Contract/Number"/> от <xsl:apply-templates select="Contract/Date"/></p>
				<xsl:if test="Organization">
					<xsl:apply-templates select="Organization"/>
				</xsl:if>
				<xsl:if test="IndividualEntrepreneur">
					<xsl:apply-templates select="IndividualEntrepreneur"/>
				</xsl:if>
			</xsl:for-each>
		</xsl:if>
	</xsl:template>
	
	<xsl:template name="Purposes">
		<a name="ch6"/>
		<h3 class="bckgr upper">6. Цели инженерных изысканий</h3>
		<xsl:if test="count(//Purposes/Purpose) = 0">
			<p>Задачи изысканий не указаны.</p>
		</xsl:if>
		<xsl:if test="count(Content/Purposes/Purpose) != 0">
			<p class="italic bold center">Общие цели</p>
			<xsl:for-each select="Content/Purposes/Purpose">
				<p>
					<xsl:number value="position()" format="1. "/>
					<xsl:value-of select="."/>
				</p>
			</xsl:for-each>
		</xsl:if>
		<xsl:for-each select="Content/EngineeringSurveyTypes/BasicEngineeringSurvey[Purposes] | Content/EngineeringSurveyTypes/SpecialEngineeringSurvey[Purposes] | Content/EngineeringSurveyTypes/OtherEngineeringSurvey[Purposes]">
			<p class="italic bold center">
				<xsl:if test="not(OtherEngineeringSurveyType)">
					<xsl:call-template name="SurveyTypeList">
						<xsl:with-param name="Code" select="BasicEngineeringSurveyType | SpecialEngineeringSurveyType"/>
					</xsl:call-template>
				</xsl:if>
				<xsl:if test="OtherEngineeringSurveyType">
					<xsl:for-each select="OtherEngineeringSurveyType"><xsl:value-of select="."/><xsl:if test="position() != last()">, </xsl:if></xsl:for-each>
				</xsl:if>
			</p>

			<xsl:for-each select="Purposes/Purpose">
				<p>
					<xsl:number value="position()" format="1. "/>
					<xsl:value-of select="."/>
				</p>
			</xsl:for-each>
		</xsl:for-each>
	</xsl:template>

	<xsl:template name="Tasks">
		<a name="ch7"/>
		<h3 class="bckgr upper">7. Задачи инженерных изысканий</h3>
		<xsl:if test="count(//Tasks/Task) = 0">
			<p>Цели изысканий не указаны.</p>
		</xsl:if>
		<xsl:if test="count(Content/Tasks/Task) != 0">
			<p class="italic bold center">Общие задачи</p>
			<xsl:for-each select="Content/Tasks/Task">
				<p>
					<xsl:number value="position()" format="1. "/>
					<xsl:value-of select="."/>
				</p>
			</xsl:for-each>
		</xsl:if>
		<xsl:for-each select="Content/EngineeringSurveyTypes/BasicEngineeringSurvey[Tasks] | Content/EngineeringSurveyTypes/SpecialEngineeringSurvey[Tasks] | Content/EngineeringSurveyTypes/OtherEngineeringSurvey[Tasks]">
			<p class="italic bold center">
				<xsl:if test="not(OtherEngineeringSurveyType)">
					<xsl:call-template name="SurveyTypeList">
						<xsl:with-param name="Code" select="BasicEngineeringSurveyType | SpecialEngineeringSurveyType"/>
					</xsl:call-template>
				</xsl:if>
				<xsl:if test="OtherEngineeringSurveyType">
					<xsl:for-each select="OtherEngineeringSurveyType"><xsl:value-of select="."/><xsl:if test="position() != last()">, </xsl:if></xsl:for-each>
				</xsl:if>
			</p>

			<xsl:for-each select="Tasks/Task">
				<p>
					<xsl:number value="position()" format="1. "/>
					<xsl:value-of select="."/>
				</p>
			</xsl:for-each>
		</xsl:for-each>
	</xsl:template>

	<xsl:template name="EngineeringSurveyTypes">
		<a name="ch8"/>
		<h3 class="bckgr upper">8. Виды необходимых изысканий</h3>
		<h3 class="bckgr upper">Основные виды инженерных изысканий</h3>
		<xsl:if test="count(//EngineeringSurveyTypes/BasicEngineeringSurvey) = 0">
			<p>Основные виды изысканий не требуются.</p>
		</xsl:if>
		<xsl:if test="count(//EngineeringSurveyTypes/BasicEngineeringSurvey) != 0">
			<xsl:for-each select="//EngineeringSurveyTypes/BasicEngineeringSurvey">
				<xsl:apply-templates select="."/>
			</xsl:for-each>
		</xsl:if>

		<h3 class="bckgr upper">Специальные виды инженерных изысканий</h3>
		<xsl:if test="count(//EngineeringSurveyTypes/SpecialEngineeringSurvey) = 0">
			<p>Специальные виды изысканий не требуются.</p>
		</xsl:if>
		<xsl:if test="count(//EngineeringSurveyTypes/SpecialEngineeringSurvey) != 0">
			<xsl:for-each select="//EngineeringSurveyTypes/SpecialEngineeringSurvey">
				<xsl:apply-templates select="."/>
			</xsl:for-each>
		</xsl:if>

		<h3 class="bckgr upper">Иные виды инженерных изысканий</h3>
		<xsl:if test="count(//EngineeringSurveyTypes/OtherEngineeringSurvey) = 0">
			<p>Иные виды изысканий не требуются.</p>
		</xsl:if>
		<xsl:if test="count(//EngineeringSurveyTypes/OtherEngineeringSurvey) != 0">
			<xsl:for-each select="//EngineeringSurveyTypes/OtherEngineeringSurvey">
				<xsl:apply-templates select="."/>
			</xsl:for-each>
		</xsl:if>
	</xsl:template>

	<xsl:template match="BasicEngineeringSurvey | SpecialEngineeringSurvey | OtherEngineeringSurvey">
		<xsl:if test="BasicEngineeringSurveyType">
			<h3>
				<xsl:call-template name="SurveyTypeList">
					<xsl:with-param name="Code" select="BasicEngineeringSurveyType"/>
				</xsl:call-template>
			</h3>
		</xsl:if>

		<xsl:if test="SpecialEngineeringSurveyType">
			<h3>
				<xsl:call-template name="SurveyTypeList">
					<xsl:with-param name="Code" select="SpecialEngineeringSurveyType"/>
				</xsl:call-template>
			</h3>
		</xsl:if>

		<xsl:if test="OtherEngineeringSurveyType">
			<h3>
				<xsl:for-each select="OtherEngineeringSurveyType"><xsl:value-of select="."/><xsl:if test="position() != last()">, </xsl:if></xsl:for-each>
			</h3>
		</xsl:if>

		<xsl:call-template name="TextBlockInTable">
			<xsl:with-param name="obj" select="AdditionalRequirements"/>
		</xsl:call-template>

		<xsl:if test="EngineeringSurveyAuthors/Author/*">
			<h3>Сведения о предполагаемых исполнителях изысканий </h3>

			<xsl:for-each select="EngineeringSurveyAuthors/Author/*">
				<xsl:apply-templates select="."/>
			</xsl:for-each>

		</xsl:if>
		<br/>
		<br/>

	</xsl:template>

	<xsl:template name="TechnogenicImpacts">
		<a name="ch9"/>
		<h3 class="bckgr upper">9. Предполагаемые техногенные воздействия объекта на окружающую среду</h3>
		<xsl:apply-templates select="//TechnogenicImpacts"/>
	</xsl:template>
	
	<xsl:template name="Ecology">
		<a name="ch10"/>
		<h3 class="bckgr upper">10. Описание экологической обстановки</h3>
		
		<xsl:if test="//Ecology/ExistingPollutionSources">
			<h3>Существующие источники загрязнения окружающей среды на рассматриваемой территории</h3>
			<xsl:apply-templates select="//Ecology/ExistingPollutionSources"/>
			<br/>
		</xsl:if>
		
		<xsl:if test="//Ecology/PlannedPollutionSources">
			<h3>Проектируемые источники загрязнения окружающей среды</h3>
			<xsl:apply-templates select="//Ecology/PlannedPollutionSources"/>
			<br/>
		</xsl:if>
		
		<xsl:if test="//Ecology/PossibleAccident">
			<h3>Место и тип возможной аварии</h3>
			<xsl:apply-templates select="//Ecology/PossibleAccident"/>
			<br/>
		</xsl:if>
		
		<xsl:if test="//Ecology/LandWithdraw">
			<h3>Границы и площадь изъятия земель разной категории</h3>
			<xsl:apply-templates select="//Ecology/LandWithdraw"/>
			<br/>
		</xsl:if>
		
		<xsl:if test="//Ecology/WaterSource">
			<h3>Место предполагаемого забора воды из поверхностных источников</h3>
			<xsl:apply-templates select="//Ecology/WaterSource"/>
			<br/>
		</xsl:if>
		
		<xsl:if test="//Ecology/WaterRelease">
			<h3>Место проектируемого сброса сточных вод</h3>
			<xsl:apply-templates select="//Ecology/WaterRelease"/>
			<br/>
		</xsl:if>
		
	</xsl:template>
	
	<xsl:template name="BoundariesArealLinear">
		<a name="ch11"/>
		<h3 class="bckgr upper">11. Данные о границах площадки (площадок) и (или) трассы (трасс) линейного сооружения (точки ее начала и окончания, протяженность)</h3>
		
		<xsl:if test="//BoundariesArealLinear/AreasImages">
			<h3>Схемы площадок (трасс)</h3>
			<xsl:apply-templates select="//BoundariesArealLinear/AreasImages/Image"/>
			<br/>
		</xsl:if>
		
		<xsl:if test="//BoundariesArealLinear/Areas">
			<h3>Описание площадок</h3>
			<xsl:apply-templates select="//BoundariesArealLinear/Areas/Area"/>
			<br/>
		</xsl:if>
		
		<xsl:if test="//BoundariesArealLinear/LinearRoutes">
			<h3>Трассы линейного сооружения</h3>
			<xsl:apply-templates select="//BoundariesArealLinear/LinearRoutes/LinearRoute"/>
			<br/>
		</xsl:if>
		
		<xsl:if test="//BoundariesArealLinear/ProjectedPlanningMarks">
			<h3>Сведения о проектируемых планировочных отметках</h3>
			<xsl:call-template name="TextBlockInTable">
				<xsl:with-param name="obj" select="//BoundariesArealLinear/ProjectedPlanningMarks"/>
			</xsl:call-template>
		</xsl:if>
		
		<xsl:if test="//BoundariesArealLinear/AreaOutWorks">
			<h3>Сведения о работах за границей землеотвода, площади работ</h3>
			<xsl:call-template name="TextBlockInTable">
				<xsl:with-param name="obj" select="//BoundariesArealLinear/AreaOutWorks"/>
			</xsl:call-template>
		</xsl:if>
		
	</xsl:template>
	
	<xsl:template name="DangerousNaturalProcessesSoils">
		<a name="ch12"/>
		<h3 class="bckgr upper">12. Наличие предполагаемых опасных природных процессов и явлений, многолетнемерзлых и специфических грунтов на территории расположения объекта</h3>
		
		<xsl:if test="/Document/Content/DangerousNaturalProcesses/DangerousNaturalProcesses">
			<h3>Сведения об опасных природных процессах и явлениях</h3>
			
			<p>На площадке изысканий предполагается наличие: <xsl:for-each select="/Document/Content/DangerousNaturalProcesses/DangerousNaturalProcesses/Process">
				<xsl:value-of select="."/>
				<xsl:if test="position() != last()">, </xsl:if>
			</xsl:for-each>
			</p>
			<xsl:if test="/Document/Content/DangerousNaturalProcesses/DangerousNaturalProcessesAdditional">
				<xsl:call-template name="TextBlockInTable">
					<xsl:with-param name="obj" select="/Document/Content/DangerousNaturalProcesses/DangerousNaturalProcessesAdditional"/>
				</xsl:call-template>
				
			</xsl:if>
		</xsl:if>
		
		<xsl:if test="/Document/Content/DangerousNaturalProcesses/PermafrostSoils">
			<h3>Сведения об наличии многолетнемерзлых грунтов</h3>
			
			<xsl:if test="/Document/Content/DangerousNaturalProcesses/PermafrostSoils = 'да'">
				<p>На площадке изысканий предполагается наличие многолетнемерзлых грунтов.</p>
			</xsl:if>
			<xsl:if test="/Document/Content/DangerousNaturalProcesses/PermafrostSoils = 'нет'">
				<p>На площадке изысканий не предполагается наличие многолетнемерзлых грунтов.</p>
			</xsl:if>
			<xsl:if test="/Document/Content/DangerousNaturalProcesses/PermafrostSoilsAdditional">
				<xsl:call-template name="TextBlockInTable">
					<xsl:with-param name="obj" select="/Document/Content/DangerousNaturalProcesses/PermafrostSoilsAdditional"/>
				</xsl:call-template>
			</xsl:if>
		</xsl:if>
		
		<xsl:if test="/Document/Content/DangerousNaturalProcesses/SpecificSoils">
			<h3>Сведения о наличии специфических грунтов</h3>
			
			<p>На площадке изысканий предполагается наличие следующих специфических грунтов: <xsl:for-each select="/Document/Content/DangerousNaturalProcesses/SpecificSoils/Soil">
				<xsl:value-of select="."/>
				<xsl:if test="position() != last()">, </xsl:if>
			</xsl:for-each>
			</p>
			<xsl:if test="/Document/Content/DangerousNaturalProcesses/SpecificSoilsAdditional">
				<xsl:call-template name="TextBlockInTable">
					<xsl:with-param name="obj" select="/Document/Content/DangerousNaturalProcesses/SpecificSoilsAdditional"/>
				</xsl:call-template>
			</xsl:if>
		</xsl:if>
		
	</xsl:template>
	
	<xsl:template name="Requirements">
		<a name="ch13"/>
		<h3 class="bckgr upper">13. Требования к выполнению изысканий</h3>

		<xsl:if test="//Requirements/ScientificSupport">
			<h3>Требование о необходимости научного сопровождения инженерных изысканий (для объектов повышенного уровня ответственности, а также для объектов нормального уровня ответственности, строительство которых планируется на территории со сложными природными и техногенными условиями) и проведения дополнительных исследований, не предусмотренных требованиями нормативных документов (НД) обязательного применения (в случае, если такое требование предъявляется)</h3>
			<xsl:apply-templates select="//Requirements/ScientificSupport"/>
			<br/>
		</xsl:if>

		<xsl:if test="//Requirements/AccuracySecurity">
			<h3>Требования к точности и обеспеченности необходимых данных и характеристик при инженерных изысканиях, превышающие предусмотренные требованиями НД обязательного применения (в случае, если такие требования предъявляются)</h3>
			<xsl:apply-templates select="//Requirements/AccuracySecurity"/>
			<br/>
		</xsl:if>

		<xsl:if test="//Requirements/ForecastChangesNaturalConditions">
			<h3>Требования к составлению прогноза изменения природных условий</h3>
			<xsl:apply-templates select="//Requirements/ForecastChangesNaturalConditions"/>
			<br/>
		</xsl:if>

		<xsl:if test="//Requirements/SuggestionsRecommendation">
			<h3>Требования о подготовке предложений и рекомендаций для принятия решений по организации инженерной защиты территории, зданий и сооружений от опасных природных процессов и техногенных воздействий и устранению или ослаблению их влияния</h3>
			<xsl:apply-templates select="//Requirements/SuggestionsRecommendation"/>
			<br/>
		</xsl:if>

		<xsl:if test="//Requirements/ControlQuality">
			<h3>Требования по обеспечению контроля качества при выполнении инженерных изысканий</h3>
			<xsl:call-template name="ControlQuality"/>
			<br/>
		</xsl:if>

		<xsl:if test="//Requirements/CompositionOrderTransfer">
			<h3>Требования к составу, форме и формату предоставления результатов инженерных изысканий, порядку их передачи заказчику</h3>
			<xsl:apply-templates select="//Requirements/CompositionOrderTransfer"/>
			<br/>
		</xsl:if>

		<xsl:if test="//Requirements/ArchivalMaterials">
			<h3>Перечень передаваемых заказчиком во временное пользование исполнителю инженерных изысканий, результатов ранее выполненных инженерных изысканий и исследований, данных о наблюдавшихся на территории инженерных изысканий осложнениях в процессе строительства и эксплуатации сооружений, в том числе деформациях и аварийных ситуациях</h3>
			<xsl:call-template name="ArchivalMaterials"/>
			<br/>
		</xsl:if>

		<xsl:if test="//Requirements/ModelFormat">
			<h3>Требования к форме предоставления результатов инженерных изысканий, позволяющей осуществлять их использование при формировании и ведении информационной модели (при необходимости)</h3>
			<xsl:apply-templates select="//Requirements/ModelFormat"/>
			<br/>
		</xsl:if>

		<xsl:if test="//Requirements/UsedNorms">
			<h3>Перечень нормативных правовых актов, НД, в соответствии с требованиями которых необходимо выполнять инженерные изыскания</h3>
			<xsl:call-template name="UsedNorms"/>
			<br/>
		</xsl:if>

	</xsl:template>

	<xsl:template name="ControlQuality">
		<xsl:if test="//Requirements/ControlQuality/InsideControlQuality">
			<p class="center bold italic">Требования по обеспечению внутреннего контроля качества при выполнении инженерных изысканий</p>
			<xsl:apply-templates select="//Requirements/ControlQuality/InsideControlQuality"/>
			<br/>
		</xsl:if>

		<xsl:if test="//Requirements/ControlQuality/OutsideControlQuality">
			<p class="center bold italic">Требования по обеспечению внешнего контроля качества при выполнении инженерных изысканий</p>
			<xsl:apply-templates select="//Requirements/ControlQuality/OutsideControlQuality/Description"/>
			<br/>
			<xsl:if test="//Requirements/ControlQuality/OutsideControlQuality/DeveloperControl">
				<p>Внешний контроль качества осуществляется силами Застройщика.</p>
				<p>Необходимо обеспечить доступ следующим ответственным лицам:</p>
				<xsl:for-each select="//Requirements/ControlQuality/OutsideControlQuality/DeveloperControl/Representative">
					<p>
						<xsl:number value="position()" format="1. "/>
						<xsl:value-of select="Surname"/>
						<xsl:text> </xsl:text>
						<xsl:value-of select="Name"/>
						<xsl:text> </xsl:text>
						<xsl:value-of select="Patronymic"/>
					</p>
				</xsl:for-each>
			</xsl:if>

			<xsl:if test="//Requirements/ControlQuality/OutsideControlQuality/TechnicalCustomerControl">
				<p>Внешний контроль качества осуществляется силами Технического заказчика.</p>
				<p>Необходимо обеспечить доступ следующим ответственным лицам:</p>
				<xsl:for-each select="//Requirements/ControlQuality/OutsideControlQuality/TechnicalCustomerControl/Representative">
					<p>
						<xsl:number value="position()" format="1. "/>
						<xsl:value-of select="Surname"/>
						<xsl:text> </xsl:text>
						<xsl:value-of select="Name"/>
						<xsl:text> </xsl:text>
						<xsl:value-of select="Patronymic"/>
					</p>
				</xsl:for-each>
			</xsl:if>

			<xsl:if test="//Requirements/ControlQuality/OutsideControlQuality/OutsideOrganizationControl">
				<p>Внешний контроль качества осуществляется силами специализированных организаций:</p>
				<xsl:for-each select="//Requirements/ControlQuality/OutsideControlQuality/OutsideOrganizationControl">
					<xsl:apply-templates select="Organization | IndividualEntrepreneur"/>
					<p>Необходимо обеспечить доступ следующим ответственным лицам:</p>
					<xsl:for-each select="Representative">
						<p>
							<xsl:number value="position()" format="1. "/>
							<xsl:value-of select="Surname"/>
							<xsl:text> </xsl:text>
							<xsl:value-of select="Name"/>
							<xsl:text> </xsl:text>
							<xsl:value-of select="Patronymic"/>
						</p>
					</xsl:for-each>
					<br/>
					<br/>
				</xsl:for-each>
			</xsl:if>

		</xsl:if>

	</xsl:template>

	<xsl:template match="Area">
		<xsl:variable name="CoorSystem">
			<xsl:choose>
				<xsl:when test="CoordinateAndHeightSystem/International">Международная - <xsl:value-of select="CoordinateAndHeightSystem/International/@Name"/></xsl:when>
				<xsl:when test="CoordinateAndHeightSystem/State">Государственная - <xsl:value-of select="CoordinateAndHeightSystem/State/@Name"/></xsl:when>
				<xsl:when test="CoordinateAndHeightSystem/Regional">Местная - <xsl:value-of select="CoordinateAndHeightSystem/Regional/@Name"/></xsl:when>
				<xsl:when test="CoordinateAndHeightSystem/Local">Локальная - <xsl:value-of select="CoordinateAndHeightSystem/Local/@Name"/></xsl:when>
			</xsl:choose>
		</xsl:variable>
		
		<xsl:variable name="HeightSystem">
			<xsl:choose>
				<xsl:when test="CoordinateAndHeightSystem/International">
					<xsl:value-of select="CoordinateAndHeightSystem/International/@HeightSystem"/>
				</xsl:when>
				<xsl:when test="CoordinateAndHeightSystem/State">
					<xsl:value-of select="CoordinateAndHeightSystem/State/@HeightSystem"/>
				</xsl:when>
				<xsl:when test="CoordinateAndHeightSystem/Regional">
					<xsl:value-of select="CoordinateAndHeightSystem/Regional/@HeightSystem"/>
				</xsl:when>
				<xsl:when test="CoordinateAndHeightSystem/Local">
					<xsl:value-of select="CoordinateAndHeightSystem/Local/@HeightSystem"/>
				</xsl:when>
			</xsl:choose>
		</xsl:variable>

		<h3>
			<xsl:value-of select="@Name"/>
		</h3>
		<p>Система координат: <xsl:value-of select="$CoorSystem"/></p>
		<p>Система высот: <xsl:value-of select="$HeightSystem"/></p>
		<xsl:if test="Point">
			<p>Характерные точки площадки (участка)</p>
			<table>
				<thead>
					<tr>
						<th width="20%">№ п/п</th>
						<th width="40%">Координата X</th>
						<th width="40%">Координата Y</th>
					</tr>
				</thead>
				<xsl:for-each select="Point">
					<tr>
						<td class="center" style="width: 20%;">
							<xsl:number value="position()" format="1. "/>
						</td>
						<td class="center" style="width: 40%;">
							<xsl:value-of select="@CoordinateX"/>
						</td>
						<td class="center" style="width: 40%;">
							<xsl:value-of select="@CoordinateY"/>
						</td>
					</tr>
				</xsl:for-each>
			</table>
		</xsl:if>

	</xsl:template>

	<xsl:template match="LinearRoute">
		<xsl:variable name="CoorSystem">
			<xsl:choose>
				<xsl:when test="CoordinateAndHeightSystem/International">Международная - <xsl:value-of select="CoordinateAndHeightSystem/International/@Name"/></xsl:when>
				<xsl:when test="CoordinateAndHeightSystem/State">Государственная - <xsl:value-of select="CoordinateAndHeightSystem/State/@Name"/></xsl:when>
				<xsl:when test="CoordinateAndHeightSystem/Regional">Местная - <xsl:value-of select="CoordinateAndHeightSystem/Regional/@Name"/></xsl:when>
				<xsl:when test="CoordinateAndHeightSystem/Local">Локальная - <xsl:value-of select="CoordinateAndHeightSystem/Local/@Name"/></xsl:when>
			</xsl:choose>
		</xsl:variable>
		
		<xsl:variable name="HeightSystem">
			<xsl:choose>
				<xsl:when test="CoordinateAndHeightSystem/International">
					<xsl:value-of select="CoordinateAndHeightSystem/International/@HeightSystem"/>
				</xsl:when>
				<xsl:when test="CoordinateAndHeightSystem/State">
					<xsl:value-of select="CoordinateAndHeightSystem/State/@HeightSystem"/>
				</xsl:when>
				<xsl:when test="CoordinateAndHeightSystem/Regional">
					<xsl:value-of select="CoordinateAndHeightSystem/Regional/@HeightSystem"/>
				</xsl:when>
				<xsl:when test="CoordinateAndHeightSystem/Local">
					<xsl:value-of select="CoordinateAndHeightSystem/Local/@HeightSystem"/>
				</xsl:when>
			</xsl:choose>
		</xsl:variable>
		<h3>
			<xsl:value-of select="@Name"/>
		</h3>
		<p>Система координат: <xsl:value-of select="$CoorSystem"/></p>
		<p>Система высот: <xsl:value-of select="$HeightSystem"/></p>
		<p>Характерные точки трассы (маршрута)</p>
		<table>
			<thead>
				<tr>
					<th width="20%">№ п/п</th>
					<th width="40%">Координата X</th>
					<th width="40%">Координата Y</th>
				</tr>
			</thead>

			<tr>
				<td class="center" colspan="3">Начальная точка трассы (маршрута)</td>
			</tr>
			<tr>
				<td class="center" style="width: 20%;"> </td>
				<td class="center" style="width: 40%;">
					<xsl:value-of select="StartPoint/@CoordinateX"/>
				</td>
				<td class="center" style="width: 40%;">
					<xsl:value-of select="StartPoint/@CoordinateY"/>
				</td>
			</tr>

			<xsl:if test="MiddlePoint">
				<tr>
					<td class="center" colspan="3">Промежуточные точки трассы (маршрута)</td>
				</tr>
				<xsl:for-each select="MiddlePoint">
					<tr>
						<td class="center" style="width: 20%;">
							<xsl:number value="position()" format="1. "/>
						</td>
						<td class="center" style="width: 40%;">
							<xsl:value-of select="@CoordinateX"/>
						</td>
						<td class="center" style="width: 40%;">
							<xsl:value-of select="@CoordinateY"/>
						</td>
					</tr>
				</xsl:for-each>
			</xsl:if>

			<tr>
				<td class="center" colspan="3">Конечная точка трассы (маршрута)</td>
			</tr>
			<tr>
				<td class="center" style="width: 20%;"> </td>
				<td class="center" style="width: 40%;">
					<xsl:value-of select="FinishPoint/@CoordinateX"/>
				</td>
				<td class="center" style="width: 40%;">
					<xsl:value-of select="FinishPoint/@CoordinateY"/>
				</td>
			</tr>

		</table>

	</xsl:template>

	<xsl:template name="AvailableDocuments">
		<a name="ch14"/>
		<h3 class="bckgr upper">14. Документы, прилагаемые к заданию на выполнение инженерных изысканий</h3>

		<table>
			<xsl:if test="count(//AvailableDocuments/DocumentInfo[File]) > 0">
				<thead>
					<tr>
						<th width="5%">№ п/п</th>
						<th width="65%">Наименование и реквизиты документа</th>
						<th width="25%">Наименование<br/>файла документа<br/>(подписи к файлу)</th>
						<th>Контрольная сумма файла</th>
					</tr>
				</thead>
			</xsl:if>
			<tbody>
				<xsl:for-each select="//AvailableDocuments/DocumentInfo">
					<xsl:sort select="@Type"/>
					<xsl:call-template name="DocumentFilesTable"/>
				</xsl:for-each>
			</tbody>
		</table>

		<xsl:if test="/Document/Content/AvailableDocuments/Note">
			<p class="upper">Дополнительные сведения:</p>
			<table>
				<tr>
					<td>
						<xsl:value-of select="//AvailableDocuments/Note"/>
					</td>
				</tr>
			</table>
		</xsl:if>

	</xsl:template>

	<xsl:template name="ArchivalMaterials">

		<table>
			<xsl:if test="count(//Requirements/ArchivalMaterials/DocumentInfo[File]) > 0">
				<thead>
					<tr>
						<th width="5%">№ п/п</th>
						<th width="65%">Наименование и реквизиты документа</th>
						<th width="25%">Наименование<br/>файла документа<br/>(подписи к файлу)</th>
						<th>Контрольная сумма файла</th>
					</tr>
				</thead>
			</xsl:if>
			<tbody>
				<xsl:for-each select="//Requirements/ArchivalMaterials/DocumentInfo">
					<xsl:sort select="@Type"/>
					<xsl:call-template name="DocumentFilesTable"/>
				</xsl:for-each>
			</tbody>
		</table>

		<xsl:if test="//Requirements/ArchivalMaterials/Note">
			<p class="upper">Дополнительные сведения:</p>
			<table>
				<tr>
					<td>
						<xsl:value-of select="//ArchivalMaterials/Note"/>
					</td>
				</tr>
			</table>
		</xsl:if>

	</xsl:template>

	<xsl:template name="DocumentFilesTable">
		<xsl:param name="Pos" select="position()"/>
		<xsl:variable name="FileNumber" select="count(File) + count(File/SignFile)"/>
		<xsl:if test="$FileNumber != 0">
			<xsl:for-each select="File">
				<tr>
					<xsl:if test="position() = 1">
						<td>
							<xsl:if test="$FileNumber != 1">
								<xsl:attribute name="rowspan">
									<xsl:value-of select="$FileNumber"/>
								</xsl:attribute>
							</xsl:if>
							<xsl:number value="$Pos"/>. </td>
						<td>
							<xsl:if test="$FileNumber != 1">
								<xsl:attribute name="rowspan">
									<xsl:value-of select="$FileNumber"/>
								</xsl:attribute>
							</xsl:if>
							<a>
								<xsl:attribute name="name">
									<xsl:value-of select="../@Id"/>
								</xsl:attribute>
							</a>
							<xsl:apply-templates select=".."/>
						</td>
					</xsl:if>
					<td>
						<xsl:value-of select="Name"/>
					</td>
					<td class="center">
						<xsl:value-of select="Checksum"/>
					</td>
				</tr>
				<xsl:for-each select="SignFile">
					<tr>
						<td class="italic">
							<xsl:value-of select="Name"/>
						</td>
						<td class="center italic">
							<xsl:value-of select="Checksum"/>
						</td>
					</tr>
				</xsl:for-each>
			</xsl:for-each>
		</xsl:if>

		<xsl:if test="$FileNumber = 0 and ReferenceToDocumentId">
			<tr>
				<td><xsl:number value="$Pos"/>.</td>
				<td>
					<a>
						<xsl:attribute name="name">
							<xsl:value-of select="@Id"/>
						</xsl:attribute>
					</a>
					<xsl:apply-templates select="."/>
				</td>
				<td colspan="2"> Содержится в составе документа: <br/>
					<xsl:for-each select="key('DocumentsInfoById', ReferenceToDocumentId)">
						<a class="italic">
							<xsl:attribute name="href">#<xsl:value-of select="@Id"/></xsl:attribute>
							<xsl:value-of select="Name"/>
							<xsl:text> от </xsl:text>
							<xsl:apply-templates select="Date"/>
							<xsl:text> № </xsl:text>
							<xsl:value-of select="Number"/>
						</a>
					</xsl:for-each>
				</td>
			</tr>
		</xsl:if>
		<xsl:if test="$FileNumber = 0 and WebLink">
			<tr>
				<td><xsl:number value="$Pos"/>.</td>
				<td>
					<a>
						<xsl:attribute name="name">
							<xsl:value-of select="@Id"/>
						</xsl:attribute>
					</a>
					<xsl:apply-templates select="."/>
				</td>
				<td colspan="2"> Документ опубликован:<br/>
					<a target="_blank">
						<xsl:attribute name="href">
							<xsl:value-of select="WebLink"/>
						</xsl:attribute>
						<xsl:value-of select="WebLink"/>
					</a>
				</td>
			</tr>
		</xsl:if>
		<xsl:if test="$FileNumber = 0 and not(ReferenceToDocumentId) and not(WebLink)">
			<tr><td><xsl:number value="$Pos"/>.</td><td colspan="3"><xsl:apply-templates select="."/></td></tr>
		</xsl:if>
	</xsl:template>

	<xsl:template match="DocumentInfo">
		<xsl:value-of select="Name"/>
		<xsl:if test="Changes != ''"> (<xsl:value-of select="Changes"/>) </xsl:if>
		<xsl:text> от </xsl:text>
		<xsl:apply-templates select="Date"/>
		<xsl:text> № </xsl:text>
		<xsl:value-of select="Number"/>, <xsl:if test="Author">
			<xsl:apply-templates select="Author/Organization">
				<xsl:with-param name="ShowType">1</xsl:with-param>
			</xsl:apply-templates>
			<xsl:apply-templates select="Author/IndividualEntrepreneur">
				<xsl:with-param name="ShowType">1</xsl:with-param>
			</xsl:apply-templates>
			<xsl:apply-templates select="Author/Person">
				<xsl:with-param name="ShowType">1</xsl:with-param>
			</xsl:apply-templates>
		</xsl:if>
		<xsl:if test="AuthorNote"><xsl:value-of select="AuthorNote"/></xsl:if>
	</xsl:template>

	<xsl:template match="Placement">
		
		<table>
			<tr>
				<td width="35%">Адрес:</td>
				<td width="65%"><xsl:apply-templates select="Address"/></td>
			</tr>
			<xsl:if test="CadastralAreas/CadastralDistrict">
				<tr>
					<td width="35%">Кадастровые кварталы:</td>
					<td width="65%">
						<xsl:for-each select="CadastralAreas/CadastralDistrict">
							<xsl:value-of select="."/><br/>
						</xsl:for-each>
					</td>
				</tr>
			</xsl:if>
			<xsl:if test="CadastralAreas/CadastralSite">
				<tr>
					<td width="35%">Кадастровые участки:</td>
					<td width="65%">
						<xsl:for-each select="CadastralAreas/CadastralSite">
							<xsl:value-of select="."/><br/>
						</xsl:for-each>
					</td>
				</tr>
			</xsl:if>
			
			<xsl:if test="Areas">
				<xsl:variable name="CoorSystem">
					<xsl:choose>
						<xsl:when test="CoordinateAndHeightSystem/International">Международная - <xsl:value-of select="CoordinateAndHeightSystem/International/@Name"/></xsl:when>
						<xsl:when test="CoordinateAndHeightSystem/State">Государственная - <xsl:value-of select="CoordinateAndHeightSystem/State/@Name"/></xsl:when>
						<xsl:when test="CoordinateAndHeightSystem/Regional">Местная - <xsl:value-of select="CoordinateAndHeightSystem/Regional/@Name"/></xsl:when>
						<xsl:when test="CoordinateAndHeightSystem/Local">Локальная - <xsl:value-of select="CoordinateAndHeightSystem/Local/@Name"/></xsl:when>
					</xsl:choose>
				</xsl:variable>
				
				<xsl:variable name="HeightSystem">
					<xsl:choose>
						<xsl:when test="CoordinateAndHeightSystem/International">
							<xsl:value-of select="CoordinateAndHeightSystem/International/@HeightSystem"/>
						</xsl:when>
						<xsl:when test="CoordinateAndHeightSystem/State">
							<xsl:value-of select="CoordinateAndHeightSystem/State/@HeightSystem"/>
						</xsl:when>
						<xsl:when test="CoordinateAndHeightSystem/Regional">
							<xsl:value-of select="CoordinateAndHeightSystem/Regional/@HeightSystem"/>
						</xsl:when>
						<xsl:when test="CoordinateAndHeightSystem/Local">
							<xsl:value-of select="CoordinateAndHeightSystem/Local/@HeightSystem"/>
						</xsl:when>
					</xsl:choose>
				</xsl:variable>
				
				<tr>
					<td width="35%">Координаты участков:</td>
					<td width="65%">
						<xsl:for-each select="Areas/Area">
							<table>
								<tr class="bckgr">
									<td colspan="2">Система координат: <xsl:value-of select="CoordinateAndHeightSystem/*/@Name"/><br/>Система высот: <xsl:value-of select="CoordinateAndHeightSystem/*/@HeightSystem"/></td>
								</tr>
								<tr class="bckgr">
									<td class="center">Координата X</td>
									<td class="center">Координата Y</td>
								</tr>
								<xsl:for-each select="Point">
									<tr>
										<td class="center"><xsl:value-of select="@CoordinateX"/></td>
										<td class="center"><xsl:value-of select="@CoordinateY"/></td>
									</tr>
								</xsl:for-each>
							</table>
						</xsl:for-each>
					</td>
				</tr>
			</xsl:if>
		</table>
		
	</xsl:template>

	<xsl:template name="SurveyTypeList">
		<xsl:param name="Code"/>
		<xsl:choose>
			<xsl:when test="$Code = '06.01' or $Code = 1">Инженерно-геодезические изыскания</xsl:when>
			<xsl:when test="$Code = '06.02' or $Code = 2">Инженерно-геологические изыскания</xsl:when>
			<xsl:when test="$Code = '06.03' or $Code = 3">Инженерно-гидрометеорологические изыскания</xsl:when>
			<xsl:when test="$Code = '06.04' or $Code = 4">Инженерно-экологические изыскания</xsl:when>
			<xsl:when test="$Code = '06.05' or $Code = 5">Инженерно-геотехнические изыскания</xsl:when>
			<xsl:when test="$Code = '06.06' or $Code = 6">Геотехнические исследования</xsl:when>
			<xsl:when test="$Code = '06.07' or $Code = 7">Обследования состояния грунтов оснований зданий и сооружений, их строительных конструкций</xsl:when>
			<xsl:when test="$Code = '06.08' or $Code = 8">Поиск и разведка подземных вод для целей водоснабжения</xsl:when>
			<xsl:when test="$Code = '06.09' or $Code = 9">Локальный мониторинг компонентов окружающей среды</xsl:when>
			<xsl:when test="$Code = '06.10' or $Code = 10">Разведка грунтовых строительных материалов</xsl:when>
			<xsl:when test="$Code = '06.11' or $Code = 11">Локальные обследования загрязнения грунтов и грунтовых вод</xsl:when>
		</xsl:choose>
	</xsl:template>

	<xsl:template name="SurveySpecialTypeList">
		<xsl:param name="Code"/>
		<xsl:choose>
			<xsl:when test="$Code = 1">Карстологические исследования</xsl:when>
			<xsl:when test="$Code = 2">Сейсмическое микрорайонирование</xsl:when>
			<xsl:when test="$Code = 3">Археологические изыскания</xsl:when>
			<xsl:when test="$Code = 4">Геоботанические исследования</xsl:when>
			<xsl:when test="$Code = 5">Математическое моделирование. Расчет гидрологических характеристик</xsl:when>
			<xsl:when test="$Code = 6">Геолого-разведочные работы</xsl:when>
			<xsl:when test="$Code = 7">Оценка территории распространения многолетнемерзлых грунтов по степени благоприятности для строительного освоения</xsl:when>
			<xsl:when test="$Code = 8">Воздушное лазерное сканирование</xsl:when>
		</xsl:choose>
	</xsl:template>

	<xsl:template name="TextBlockInTable">
		<xsl:param name="obj"/>
		<xsl:if test="$obj">
			<table>
				<tr>
					<td>
						<xsl:for-each select="$obj">
							<xsl:if test="@Title">
								<h5>
									<xsl:value-of select="@Title"/>
								</h5>
							</xsl:if>
							<xsl:apply-templates select="."/>
						</xsl:for-each>
					</td>
				</tr>
			</table>
		</xsl:if>
	</xsl:template>

	<xsl:template match="Text">
		<xsl:call-template name="StringReplace">
			<xsl:with-param name="input" select="."/>
		</xsl:call-template>
	</xsl:template>

	<xsl:template match="SubTitle">
		<h5><xsl:value-of select="."/>:</h5>
	</xsl:template>

	<xsl:template match="Image">
		<p align="center">
			<img>
				<xsl:attribute name="src">
					<xsl:value-of select="concat('data:image/', @Type, ';base64,', ImageData)"/>
				</xsl:attribute>
			</img>
			<xsl:if test="Comment">
				<xsl:value-of select="Comment"/>
			</xsl:if>
		</p>
		<br/>
	</xsl:template>

	<xsl:template match="Table">
		<table>
			<xsl:for-each select="Head | Body | Foot">
				<xsl:apply-templates select="."/>
			</xsl:for-each>
		</table>
	</xsl:template>

	<xsl:template match="Head">
		<thead>
			<xsl:for-each select="Row">
				<tr class="center">
					<xsl:if test="@Align != ''">
						<xsl:attribute name="align">
							<xsl:value-of select="@Align"/>
						</xsl:attribute>
					</xsl:if>
					<xsl:apply-templates select=".">
						<xsl:with-param name="type" select="'IsHead'"/>
					</xsl:apply-templates>
				</tr>
			</xsl:for-each>
		</thead>
	</xsl:template>

	<xsl:template match="Body">
		<tbody>
			<xsl:for-each select="Row">
				<tr>
					<xsl:if test="@Align != ''">
						<xsl:attribute name="align">
							<xsl:value-of select="@Align"/>
						</xsl:attribute>
					</xsl:if>
					<xsl:apply-templates select="."/>
				</tr>
			</xsl:for-each>
		</tbody>
	</xsl:template>

	<xsl:template match="Foot">
		<tfoot>
			<xsl:for-each select="Row">
				<tr>
					<xsl:if test="@Align != ''">
						<xsl:attribute name="align">
							<xsl:value-of select="@Align"/>
						</xsl:attribute>
					</xsl:if>
					<xsl:apply-templates select="."/>
				</tr>
			</xsl:for-each>
		</tfoot>
	</xsl:template>

	<xsl:template match="Cell">
		<xsl:param name="type" select="''"/>

		<xsl:choose>
			<xsl:when test="$type = 'IsHead'">
				<th width="10%">
					<xsl:if test="@Colspan != ''">
						<xsl:attribute name="colspan">
							<xsl:value-of select="@Colspan"/>
						</xsl:attribute>
					</xsl:if>
					<xsl:if test="@Rowspan != ''">
						<xsl:attribute name="rowspan">
							<xsl:value-of select="@Rowspan"/>
						</xsl:attribute>
					</xsl:if>
					<xsl:if test="@Align != ''">
						<xsl:attribute name="align">
							<xsl:value-of select="@Align"/>
						</xsl:attribute>
					</xsl:if>
					<xsl:value-of select="."/>
				</th>
			</xsl:when>
			<xsl:otherwise>
				<td width="10%">
					<xsl:if test="@Colspan != ''">
						<xsl:attribute name="colspan">
							<xsl:value-of select="@Colspan"/>
						</xsl:attribute>
					</xsl:if>
					<xsl:if test="@Rowspan != ''">
						<xsl:attribute name="rowspan">
							<xsl:value-of select="@Rowspan"/>
						</xsl:attribute>
					</xsl:if>
					<xsl:if test="@Align != ''">
						<xsl:attribute name="align">
							<xsl:value-of select="@Align"/>
						</xsl:attribute>
					</xsl:if>
					<xsl:value-of select="."/>
				</td>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="Date">
		<xsl:if test=". != ''">
			<xsl:variable name="mm">
				<xsl:value-of select="substring(., 9, 2)"/>
			</xsl:variable>
			<xsl:variable name="dd">
				<xsl:value-of select="substring(., 6, 2)"/>
			</xsl:variable>
			<xsl:variable name="yyyy">
				<xsl:value-of select="substring(., 1, 4)"/>
			</xsl:variable>
			<xsl:value-of select="concat($mm, '.', $dd, '.', $yyyy)"/>
		</xsl:if>
	</xsl:template>


	<xsl:template name="StringReplace">
		<xsl:param name="input"/>
		<xsl:choose>
			<xsl:when test="contains($input, '&#xA;')">
				<p class="justify">
					<xsl:value-of select="substring-before($input, '&#xA;')"/>
				</p>
				<xsl:call-template name="StringReplace">
					<xsl:with-param name="input" select="substring-after($input, '&#xA;')"/>
				</xsl:call-template>
			</xsl:when>
			<xsl:otherwise>
				<p class="justify">
					<xsl:value-of select="$input"/>
				</p>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="Organization">
		<xsl:param name="ShowType" select="0"/>

		<table>
			<xsl:if test="$ShowType != 0">
				<tr>
					<td colspan="2">
						<b>
							<xsl:if test="current()[RAFP]">Представительство (филиал) иностранного юридического лица:</xsl:if>
							<xsl:if test="current()[OGRN]">Юридическое лицо:</xsl:if>
						</b>
					</td>
				</tr>
			</xsl:if>
			<tr>
				<td style="width:25%">Полное наименование:</td>
				<td>
					<xsl:value-of select="FullName"/>
				</td>
			</tr>
			<xsl:if test="AbbreviatedName">
				<tr>
					<td>Сокращенное наименование:</td>
					<td>
						<xsl:value-of select="AbbreviatedName"/>
					</td>
				</tr>
			</xsl:if>
			<xsl:if test="OGRN">
				<tr>
					<td>ОГРН:</td>
					<td>
						<xsl:value-of select="OGRN"/>
					</td>
				</tr>
			</xsl:if>
			<xsl:if test="RAFP">
				<tr>
					<td title="Номер записи об аккредитации в государственном реестре аккредитованных филиалов, представительств иностранных юридических лиц">Номер записи об аккредитации в РАФП:</td>
					<td>
						<xsl:value-of select="RAFP"/>
					</td>
				</tr>
			</xsl:if>
			<tr>
				<td>ИНН:</td>
				<td>
					<xsl:value-of select="INN"/>
				</td>
			</tr>
			<tr>
				<td>КПП:</td>
				<td>
					<xsl:value-of select="KPP"/>
				</td>
			</tr>
			<tr>
				<td>Адрес:</td>
				<td>
					<xsl:apply-templates select="Address"/>
				</td>
			</tr>
			<xsl:if test="Email">
				<tr>
					<td>Адрес электронной почты:</td>
					<td>
						<xsl:value-of select="Email"/>
					</td>
				</tr>
			</xsl:if>
					<xsl:if test="@NOPRIZNumber">
					<tr>
		<td>Реестровый номер единого реестра о членах саморегулируемых организаций в области инженерных изысканий, архитектурно-строительного проектирования, строительства, реконструкции, капитального ремонта, сноса объектов капитального строительства: </td>
		<td><xsl:value-of select="@NOPRIZNumber"/></td>
					</tr>
		</xsl:if>
		
		</table>
	</xsl:template>

	<xsl:template match="IndividualEntrepreneur">
		<xsl:param name="ShowType" select="0"/>
		<table>
			<xsl:if test="$ShowType != 0">
				<tr>
					<td colspan="2">
						<b>Индивидуальный предприниматель:</b>
					</td>
				</tr>
			</xsl:if>
			<tr>
				<td style="width:25%">Фамилия:</td>
				<td>
					<xsl:value-of select="Surname"/>
				</td>
			</tr>
			<tr>
				<td>Имя:</td>
				<td>
					<xsl:value-of select="Name"/>
				</td>
			</tr>
			<xsl:if test="Patronymic">
				<tr>
					<td>Отчество:</td>
					<td>
						<xsl:value-of select="Patronymic"/>
					</td>
				</tr>
			</xsl:if>
			<xsl:if test="OGRNIP">
				<tr>
					<td>ОГРНИП:</td>
					<td>
						<xsl:value-of select="OGRNIP"/>
					</td>
				</tr>
			</xsl:if>
			<xsl:if test="INN">
				<tr>
					<td>ИНН:</td>
					<td>
						<xsl:value-of select="INN"/>
					</td>
				</tr>
			</xsl:if>
			<tr>
				<td>Почтовый адрес:</td>
				<td>
					<xsl:apply-templates select="PostAddress"/>
				</td>
			</tr>
			<xsl:if test="Email">
				<tr>
					<td>Адрес электронной почты:</td>
					<td>
						<xsl:value-of select="Email"/>
					</td>
				</tr>
			</xsl:if>
			
			<xsl:if test="@NOPRIZNumber">
			<tr>
			<td>Реестровый номер единого реестра о членах саморегулируемых организаций в области инженерных изысканий, архитектурно-строительного проектирования, строительства, реконструкции, капитального ремонта, сноса объектов капитального строительства: </td>
			<td><xsl:value-of select="@NOPRIZNumber"/></td>
			</tr>
		</xsl:if>
		</table>
	</xsl:template>
	   
	<xsl:template match="Person">
		<xsl:param name="ShowType" select="0"/>
		<table>
			<xsl:if test="$ShowType != 0">
				<tr>
					<td colspan="2">
						<b>Физическое лицо:</b>
					</td>
				</tr>
			</xsl:if>

			<tr>
				<td style="width:25%">Фамилия:</td>
				<td>
					<xsl:value-of select="Surname"/>
				</td>
			</tr>
			<tr>
				<td>Имя:</td>
				<td>
					<xsl:value-of select="Name"/>
				</td>
			</tr>
			<xsl:if test="Patronymic">
				<tr>
					<td>Отчество:</td>
					<td>
						<xsl:value-of select="Patronymic"/>
					</td>
				</tr>
			</xsl:if>
			<xsl:if test="SNILS">
				<tr>
					<td>СНИЛС:</td>
					<td>
						<xsl:value-of select="SNILS"/>
					</td>
				</tr>
			</xsl:if>
			<xsl:if test="PostAddress">
			<tr>
				<td>Почтовый адрес:</td>
				<td>
					<xsl:apply-templates select="PostAddress"/>
				</td>
			</tr>
			</xsl:if>
			<xsl:if test="Email">
				<tr>
					<td>Адрес электронной почты:</td>
					<td>
						<xsl:value-of select="Email"/>
					</td>
				</tr>
			</xsl:if>
		</table>
	</xsl:template>

	<xsl:template match="Address | BeginAddress | FinalAddress | PostAddress">
        <xsl:if test="RussianAddress or RussianPostAddress">
			<!--  Если в адресе есть неформализованное описание адреса выводится оно, если нет, то формируется строка из составных частей -->
            <xsl:for-each select="RussianAddress|RussianPostAddress">
            <xsl:if test="position() != 1">; </xsl:if>
            <xsl:if test="PostIndex"><xsl:value-of select="PostIndex"/><xsl:text>, </xsl:text></xsl:if>
            <xsl:if test="RegionCode != '00'">
            	<xsl:apply-templates select="RegionCode"/>
            	<xsl:text>, </xsl:text></xsl:if>			
            <xsl:value-of select="OKTMOName"/> (Код ОКТМО: <xsl:value-of select="OKTMOCode"/>)<xsl:if test="District or City or Settlement or Street or Building or Room or Note"><xsl:text>, </xsl:text></xsl:if>
            <xsl:if test="District">
                <xsl:value-of select="District"/>
                <xsl:if
                    test="City or Settlement or Street or Building or Room or Note"
                    >, </xsl:if>
            </xsl:if>
            <xsl:if test="City">
                <xsl:value-of select="City"/>
                <xsl:if test="Settlement or Street or Building or Room or Note"
                    >, </xsl:if>
            </xsl:if>
            <xsl:if test="Settlement">
                <xsl:value-of select="Settlement"/>
                <xsl:if test="Street or Building or Room or Note">, </xsl:if>
            </xsl:if>
            <xsl:if test="Street">
                <xsl:value-of select="Street"/>
                <xsl:if test="Building or Room or Note">, </xsl:if>
            </xsl:if>
            <xsl:if test="Building">
                <xsl:value-of select="Building"/>
                <xsl:if test="Room or Note">, </xsl:if>
            </xsl:if>
            <xsl:if test="Room">
                <xsl:value-of select="Room"/>
                <xsl:if test="Note">, </xsl:if>
            </xsl:if>
            <xsl:if test="Note">
                <xsl:value-of select="Note"/>
            </xsl:if>
            </xsl:for-each>
        </xsl:if>
        
        <xsl:if test="SeaRussianAddress">
            <xsl:value-of select="SeaRussianAddress"/>
        </xsl:if>
        
        <xsl:if test="ForeignAddress">
            <xsl:value-of select="ForeignAddress/Country"/>
            <xsl:text>, </xsl:text>
            <xsl:value-of select="ForeignAddress/Note"/>
        </xsl:if>
    </xsl:template>

	<xsl:template name="FunctionalRolesList">
		<xsl:param name="Code"/>
		<xsl:choose>
			<xsl:when test="$Code = 1">РАЗРАБОТКА</xsl:when>
			<xsl:when test="$Code = 2">НОРМОКОНТРОЛЬ</xsl:when>
			<xsl:when test="$Code = 3 or $Code = 'Согласовано'">СОГЛАСОВАНО</xsl:when>
			<xsl:when test="$Code = 4 or $Code = 'Утверждено'">УТВЕРЖДЕНО</xsl:when>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="RegionCode">
		<xsl:choose>
			<xsl:when test=". = 1">Республика Адыгея (Адыгея)</xsl:when>
			<xsl:when test=". = 2">Республика Башкортостан</xsl:when>
			<xsl:when test=". = 3">Республика Бурятия</xsl:when>
			<xsl:when test=". = 4">Республика Алтай</xsl:when>
			<xsl:when test=". = 5">Республика Дагестан</xsl:when>
			<xsl:when test=". = 6">Республика Ингушетия</xsl:when>
			<xsl:when test=". = 7">Кабардино-Балкарская Республика</xsl:when>
			<xsl:when test=". = 8">Республика Калмыкия</xsl:when>
			<xsl:when test=". = 9">Карачаево-Черкесская Республика</xsl:when>
			<xsl:when test=". = 10">Республика Карелия</xsl:when>
			<xsl:when test=". = 11">Республика Коми</xsl:when>
			<xsl:when test=". = 12">Республика Марий Эл</xsl:when>
			<xsl:when test=". = 13">Республика Мордовия</xsl:when>
			<xsl:when test=". = 14">Республика Саха (Якутия)</xsl:when>
			<xsl:when test=". = 15">Республика Северная Осетия-Алания</xsl:when>
			<xsl:when test=". = 16">Республика Татарстан (Татарстан)</xsl:when>
			<xsl:when test=". = 17">Республика Тыва</xsl:when>
			<xsl:when test=". = 18">Удмуртская Республика</xsl:when>
			<xsl:when test=". = 19">Республика Хакасия</xsl:when>
			<xsl:when test=". = 20">Чеченская Республика</xsl:when>
			<xsl:when test=". = 21">Чувашская Республика-Чувашия</xsl:when>
			<xsl:when test=". = 22">Алтайский край</xsl:when>
			<xsl:when test=". = 23">Краснодарский край</xsl:when>
			<xsl:when test=". = 24">Красноярский край</xsl:when>
			<xsl:when test=". = 25">Приморский край</xsl:when>
			<xsl:when test=". = 26">Ставропольский край</xsl:when>
			<xsl:when test=". = 27">Хабаровский край</xsl:when>
			<xsl:when test=". = 28">Амурская область</xsl:when>
			<xsl:when test=". = 29">Архангельская область</xsl:when>
			<xsl:when test=". = 30">Астраханская область</xsl:when>
			<xsl:when test=". = 31">Белгородская область</xsl:when>
			<xsl:when test=". = 32">Брянская область</xsl:when>
			<xsl:when test=". = 33">Владимирская область</xsl:when>
			<xsl:when test=". = 34">Волгоградская область</xsl:when>
			<xsl:when test=". = 35">Вологодская область</xsl:when>
			<xsl:when test=". = 36">Воронежская область</xsl:when>
			<xsl:when test=". = 37">Ивановская область</xsl:when>
			<xsl:when test=". = 38">Иркутская область</xsl:when>
			<xsl:when test=". = 39">Калининградская область</xsl:when>
			<xsl:when test=". = 40">Калужская область</xsl:when>
			<xsl:when test=". = 41">Камчатский край</xsl:when>
			<xsl:when test=". = 42">Кемеровская область - Кузбасс</xsl:when>
			<xsl:when test=". = 43">Кировская область</xsl:when>
			<xsl:when test=". = 44">Костромская область</xsl:when>
			<xsl:when test=". = 45">Курганская область</xsl:when>
			<xsl:when test=". = 46">Курская область</xsl:when>
			<xsl:when test=". = 47">Ленинградская область</xsl:when>
			<xsl:when test=". = 48">Липецкая область</xsl:when>
			<xsl:when test=". = 49">Магаданская область</xsl:when>
			<xsl:when test=". = 50">Московская область</xsl:when>
			<xsl:when test=". = 51">Мурманская область</xsl:when>
			<xsl:when test=". = 52">Нижегородская область</xsl:when>
			<xsl:when test=". = 53">Новгородская область</xsl:when>
			<xsl:when test=". = 54">Новосибирская область</xsl:when>
			<xsl:when test=". = 55">Омская область</xsl:when>
			<xsl:when test=". = 56">Оренбургская область</xsl:when>
			<xsl:when test=". = 57">Орловская область</xsl:when>
			<xsl:when test=". = 58">Пензенская область</xsl:when>
			<xsl:when test=". = 59">Пермский край</xsl:when>
			<xsl:when test=". = 60">Псковская область</xsl:when>
			<xsl:when test=". = 61">Ростовская область</xsl:when>
			<xsl:when test=". = 62">Рязанская область</xsl:when>
			<xsl:when test=". = 63">Самарская область</xsl:when>
			<xsl:when test=". = 64">Саратовская область</xsl:when>
			<xsl:when test=". = 65">Сахалинская область</xsl:when>
			<xsl:when test=". = 66">Свердловская область</xsl:when>
			<xsl:when test=". = 67">Смоленская область</xsl:when>
			<xsl:when test=". = 68">Тамбовская область</xsl:when>
			<xsl:when test=". = 69">Тверская область</xsl:when>
			<xsl:when test=". = 70">Томская область</xsl:when>
			<xsl:when test=". = 71">Тульская область</xsl:when>
			<xsl:when test=". = 72">Тюменская область</xsl:when>
			<xsl:when test=". = 73">Ульяновская область</xsl:when>
			<xsl:when test=". = 74">Челябинская область</xsl:when>
			<xsl:when test=". = 75">Забайкальский край</xsl:when>
			<xsl:when test=". = 76">Ярославская область</xsl:when>
			<xsl:when test=". = 77">Москва</xsl:when>
			<xsl:when test=". = 78">Санкт-Петербург</xsl:when>
			<xsl:when test=". = 79">Еврейская автономная область</xsl:when>
			<xsl:when test=". = 80">Донецкая Народная Республика</xsl:when>
			<xsl:when test=". = 81">Луганская Народная Республика</xsl:when>
			<xsl:when test=". = 83">Ненецкий автономный округ</xsl:when>
			<xsl:when test=". = 84">Херсонская область</xsl:when>
			<xsl:when test=". = 85">Запорожская область</xsl:when>
			<xsl:when test=". = 86">Ханты-Мансийский автономный округ - Югра</xsl:when>
			<xsl:when test=". = 87">Чукотский автономный округ</xsl:when>
			<xsl:when test=". = 89">Ямало-Ненецкий автономный округ</xsl:when>
			<xsl:when test=". = 91">Республика Крым</xsl:when>
			<xsl:when test=". = 92">Севастополь</xsl:when>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="EngineeringSurveyStage">
		<p>
			<xsl:if test=". = '1'">Территориальное планирование - Инженерные изыскания для подготовки документов территориального планирования</xsl:if>
			<xsl:if test=". = '2'">Планировка территории - Инженерные изыскания для подготовки документации по планировке территории</xsl:if>
			<xsl:if test=". = '3'">Выбор площадки (трассы) - Инженерные изыскания для выбора площадки (трассы)</xsl:if>
			<xsl:if test=". = '4'">1 этап - Инженерные изыскания для архитектурно-строительного проектирования при подготовке проектной документации объектов капитального строительства (1 этап)</xsl:if>
			<xsl:if test=". = '5'">2 этап - Инженерные изыскания для архитектурно-строительного проектирования при подготовке проектной документации объектов капитального строительства (2 этап)</xsl:if>
			<xsl:if test=". = '6'">В 2 этапа - Инженерные изыскания для архитектурно-строительного проектирования при подготовке проектной документации объектов капитального строительства (1+2 этап)</xsl:if>
			<xsl:if test=". = '7'">Строительство - Инженерные изыскания при строительстве зданий и сооружений</xsl:if>
			<xsl:if test=". = '8'">Реконструкция - Инженерные изыскания при реконструкции зданий и сооружений</xsl:if>
		</p>
	</xsl:template>
	
	<xsl:template match="SecurityLabel">
		<xsl:choose>
			<xsl:when test=". = 0"></xsl:when>
			<xsl:when test=". = 1">Конфиденциально</xsl:when>
			<xsl:when test=". = 2">Коммерческая тайна</xsl:when>
			<xsl:when test=". = 3">Данный материал запрещается размножать, передавать другим организациям и лицам для целей, не предусмотренных настоящим документом</xsl:when>
			<xsl:when test=". = 4">Для служебного пользования</xsl:when>
		</xsl:choose>
	</xsl:template>

</xsl:stylesheet>
