from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION_START
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from pathlib import Path

OUT = Path(r"D:\pearl web\output\Pearl_Whitepaper_中文译文.docx")
OUT.parent.mkdir(parents=True, exist_ok=True)

doc = Document()
sec = doc.sections[0]
sec.top_margin = Cm(2.2); sec.bottom_margin = Cm(2.2)
sec.left_margin = Cm(2.35); sec.right_margin = Cm(2.35)

styles = doc.styles
styles['Normal'].font.name = 'Microsoft YaHei'
styles['Normal']._element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')
styles['Normal'].font.size = Pt(10.5)
styles['Normal'].paragraph_format.space_after = Pt(6)
styles['Normal'].paragraph_format.line_spacing = 1.28
for name, size in [('Title', 20), ('Heading 1', 15), ('Heading 2', 12), ('Heading 3', 11)]:
    s = styles[name]
    s.font.name = 'Microsoft YaHei'; s._element.rPr.rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')
    s.font.size = Pt(size); s.font.color.rgb = None
    s.paragraph_format.space_before = Pt(14 if name != 'Title' else 0)
    s.paragraph_format.space_after = Pt(7)

def _math_run(text):
    r = OxmlElement('m:r')
    t = OxmlElement('m:t'); t.text = text; r.append(t)
    return r
def _seq(*items):
    out=[]
    for item in items:
        if isinstance(item, str): out.append(_math_run(item))
        elif isinstance(item, (list, tuple)): out.extend(_seq(*item))
        else: out.append(item)
    return out
def _sub(base, sub):
    e=OxmlElement('m:sSub'); ee=OxmlElement('m:e'); ss=OxmlElement('m:sub')
    for x in _seq(base): ee.append(x)
    for x in _seq(sub): ss.append(x)
    e.extend([ee,ss]); return e
def _sup(base, sup):
    e=OxmlElement('m:sSup'); ee=OxmlElement('m:e'); ss=OxmlElement('m:sup')
    for x in _seq(base): ee.append(x)
    for x in _seq(sup): ss.append(x)
    e.extend([ee,ss]); return e
def _accent(base, char):
    a=OxmlElement('m:acc'); pr=OxmlElement('m:accPr'); chr_=OxmlElement('m:chr'); chr_.set(qn('m:val'), char); pr.append(chr_)
    e=OxmlElement('m:e')
    for x in _seq(base): e.append(x)
    a.extend([pr,e]); return a
def _frac(num, den):
    f=OxmlElement('m:f'); nn=OxmlElement('m:num'); dd=OxmlElement('m:den')
    for x in _seq(num): nn.append(x)
    for x in _seq(den): dd.append(x)
    f.extend([nn,dd]); return f
def _omath(items):
    om=OxmlElement('m:oMath')
    for item in _seq(*items): om.append(item)
    return om
def _inline_math(paragraph, text):
    """Make common identifier subscripts/superscripts readable in prose."""
    import re
    token_re=re.compile(r'([A-Za-zΑ-Ωα-ωΣσδηℓÃĈ]+|\d+)(?:_(?:\(([^)]*)\)|\{([^}]*)\}|([A-Za-z0-9Α-Ωα-ω]+)))?(?:\^(?:\(([^)]*)\)|\{([^}]*)\}|([A-Za-z0-9+−-]+)))?')
    at=0
    for m in token_re.finditer(text):
        if m.start()>at: paragraph.add_run(text[at:m.start()])
        base=paragraph.add_run(m.group(1))
        sub=next((v for v in m.groups()[1:4] if v is not None), None)
        sup=next((v for v in m.groups()[4:7] if v is not None), None)
        if sub is not None:
            r=paragraph.add_run(sub); r.font.subscript=True
        if sup is not None:
            r=paragraph.add_run(sup); r.font.superscript=True
        at=m.end()
    if at<len(text): paragraph.add_run(text[at:])
def p(text='', style=None, boldlead=None):
    x = doc.add_paragraph(style=style)
    if boldlead and text.startswith(boldlead):
        r=x.add_run(boldlead); r.bold=True
        _inline_math(x, text[len(boldlead):])
    else: _inline_math(x, text)
    return x
def h(text, level=1):
    return doc.add_heading(text, level=level)
def eq(key):
    """Insert native Word OMML - not a text line with a math font."""
    x=doc.add_paragraph(); x.alignment=WD_ALIGN_PARAGRAPH.CENTER; x.paragraph_format.space_after=Pt(6)
    Atilde=_accent('A','̃'); Btilde=_accent('B','̃'); Ctilde=_accent('C','̃'); Chat=_accent('C','̂')
    NA=_sub('N','A'); NB=_sub('N','B'); IA=_sub('I','A'); IB=_sub('I','B')
    cases={
      '1': [Ctilde,' := Q(', 'A + ',NA,') Q(', 'B + ',NB,')',_sup('T',''), '  (1)'],
      '2': [Chat,' := ',Ctilde,' − A',_sup(NB,'T'),' − ',NA,_sup('B','T'),' − ',NA,_sup(NB,'T')],
      '3': ['Ticket(',_sub(Ctilde,_seq(IA,',',IB)),') := ',_sub('H','“jackpot”'),'(', 'Extract(',_sub(Ctilde,_seq(IA,',',IB)),', ',_sub('P','A'),', ',_sub('P','B'),'); ',_sub('noise','seed_A'), ')'],
      '4': [_sub('p','B'),' := (n,k,r,Quant,Device,',_sub('hash','id_B'),',',_sub('P','B'),',e)，   ',_sub('p','A'),' := (m,',_sub('hash','id_A'),',',_sub('P','A'),')  (2)'],
      '5': [_sub(Atilde,IA),' := ',_sub('NoisyQuantize',_sub('p','A')),'(',_sub('A',IA),',',_sub('E','A'),',',_sub('F','A'),')，   ',_sub(Btilde,IB),' := ',_sub('NoisyQuantize',_sub('p','B')),'(',_sub('B',IB),',',_sub('E','B'),',',_sub('F','B'),')'],
      '6': ['T := ',_sub('MatMul','Device'),'(',_sub(Atilde,IA),',',_sub(Btilde,IB),')， z := Extract(T,',_sub('P','A'),',',_sub('P','B'),')， J := ',_sub('H','“jackpot”'),'(', 'z; ',_sub('noise','seed_A'), ')'],
      '7': [_sub('v','iju'),' := ',_frac(['(',_sup(_sub('A','iu'),'2'),'+',_sup(_sub('σ','i'),_seq('A','2')),')(',_sup(_sub('B','ju'),'2'),'+',_sup(_sub('σ','j'),_seq('B','2')),')'],[_sup('2','21')]),'。  (13)'],
      '8': ['η ← max{ε(c), max',_sub('i',''),'[ε(',_sub('a','i'),') + ε(',_sub('b','i'),')]};  S ← Trunc(c,2',_sup('(η−W)',''),' + Σ',_sub('i',''),' Trunc(',_sub('p','i'),',2',_sup('(η−W)',''),')。'],
      '9': ['V ∈ ',_sup('{−128,…,127}','n×k'),'，     Σ ∈ ',_sup('BF16','n×k/8')],
    }
    x._p.append(_omath(cases[key])); return x
def bullet(text): return p('• '+text)

title=doc.add_paragraph(style='Title'); title.alignment=WD_ALIGN_PARAGRAPH.CENTER; title.add_run('Pearl 浮点方案规范')
sub=doc.add_paragraph(); sub.alignment=WD_ALIGN_PARAGRAPH.CENTER; sub.add_run('Pearl Research Team\n2026 年 9 月').italic=True
p('译注：本文为中文意译版。协议名称、缩写、算法/函数名、变量名、哈希域标签和公式均尽量保留原写法；POW、PoUW、FP8、BF16、GPU、MAC、MoE、ZK 等术语不作生硬汉化。')
h('摘要',1)
p('本白皮书给出 Pearl 区块链 PoUW 协议的规范：挖矿工作的基本单位，是在 GPU 上执行的 FP8 矩阵乘法。该方案扩展了 Komargodski 和 Weinstein [4] 提出的整数矩阵乘法 PoUW。核心思路是，噪声注入之后再进行的非线性量化会消除低秩捷径，因此可直接对输出 tile 进行哈希并作为 ticket。验证者则借助 Badash 等人 [5] 的方法，逐比特复现计算结果。协议安全性建立在如下难题之上：对经量化、带低秩噪声的矩阵进行乘法，不能以显著低于通用方法的成本完成。本文也说明了向 MoE 乘法扩展的方案。')

h('目录',1)
p('1 引言\n2 抽象协议\n3 预备知识\n4 明文验证者\n5 Jackpot policy\n6 有用矿工概览\n7 已知挖矿加速\n附录 A MoE 验证者\n附录 B ZK 验证者\n附录 C 验证者算术规范')

h('1 引言',1)
p('POW 共识刻意提高区块生产成本 [1, 2]，但传统实现需要反复计算哈希，除协议本身外没有其他价值。PoUW 用某个现实中已有需求的计算来替代这道人为谜题 [3]。难点在于无许可环境：矿工自行选择输入，因此协议必须保证，不论输入如何退化，都不能让有效 ticket 的成本低于规定工作量。')
p('本白皮书规定的 PoUW，其工作单位是 GPU 上的 FP8 矩阵乘法。矿工可自行选择矩阵，例如 AI 训练或推理任务的操作数；乘积中的每个 tile 同时也是区块生产的彩票。协议覆盖普通矩阵乘法；可选扩展覆盖 MoE 乘法，其中路由在概念上属于左操作数的一部分（附录 A）。这是 Pearl 区块链的共识层：服务 AI 工作负载的同一批乘法，也负责保护网络。')
p('本文以 Komargodski 和 Weinstein [4] 针对任意整数矩阵乘法的 PoUW 为起点，并将该协议实例化为区块链。其做法是：使用由公开 seed 导出的低秩噪声扰动操作数，计算带噪乘积，再对计算 transcript 应用随机预言机。低秩结构使诚实参与者可用几乎可忽略的成本从输出中去除噪声，因此有用计算的乘法开销为 1 + o(1)。该分析在随机预言机模型中的精确算术上完成；在其直积猜想成立时，即使全零矩阵也不比其他矩阵对更容易相乘。本文给出支持浮点矩阵乘法的替代协议。验证时，验证者需逐比特重算一个选定输出 tile；白名单 GPU 的算术具有确定性，并可按 Badash 等人 [5] 的技术复现，因此这是可行的。')
p('结构安排。第 2 节在最简洁的设定中介绍抽象协议（低秩加噪加量化）及核心困难假设；第 3 节固定记号、哈希和工作模型；第 5 节规定 jackpot policy；第 4 节规定明文验证者；第 6 节说明诚实的有用矿工；第 7 节列出已知挖矿加速方式。附录给出 MoE 与 ZK 验证者，以及逐比特一致的算术、采样和量化程序。')

h('2 抽象协议',1)
p('设 A ∈ R^(m×k)、B ∈ R^(n×k)，并令 C := ABᵀ。在常见应用里，用户选择 A、B 时的精度高于硬件乘法格式。若 Q 表示量化到该格式，通常以 Q(A)Q(B)ᵀ 近似 C。协议改用如下流程：导出随机秩 r 的噪声矩阵 N_A ∈ R^(m×k)、N_B ∈ R^(n×k)，并计算：')
eq('1')
p('每个噪声矩阵都在对应输入完成承诺后才以不可预测方式确定。乘积 C̃ 决定 POW 彩票。由于噪声为低秩，还可通过低成本修正得到有用输出：')
eq('2')
p('不量化时，Ĉ = C。量化后，协议被配置为让 Ĉ 的精度与基线乘积 Q(A)Q(B)ᵀ 相当。因为 r 很小，三个被减项都可高效计算。')
p('如果量化后仍保留低秩结构，就会产生捷径；但逐元素量化通常是非线性的：Q(A + N_A) ≠ Q(A) + Q(N_A)。虽然 N_A 的秩为 r，其逐元素量化像 Q(N_A) 的秩可能高得多。核心困难前提是：量化破坏了可利用的结构，得到的乘积不能用显著低于通用量化乘积的工作量精确计算。该前提依赖数据类型和量化器，因此协议将二者列入白名单。')
p('令 A = B = 0，可将彩票乘积化为 C̃₀ = Q(N_A)Q(N_B)ᵀ，从而单独观察该困难前提。')
p('假设 1（非正式的量化子空间困难性）。对每个允许的 k，都存在 r ≪ k，使得对随机 r 维子空间 U_A、U_B ⊂ R^k 而言，下述性质以高概率成立。分别从 U_A、U_B 随机抽取 N_A、N_B 的行；平均而言，计算 Q(N_A)Q(N_B)ᵀ 并不会比计算 Q(A)Q(B)ᵀ 显著容易，其中 A、B 的行是 R^k 中通用的随机行。两类乘积使用协议认可的同一个 Q，所需工作量都与约 mnk 次 MAC 相当。')
p('具体地，协议在 k ≤ 2¹⁶ 时使用 r = 32。这个假设比较的是计算难度，而不是两类输入的分布。')
p('与 transcript 不可预测性假设的关系。假设 1 是 [4] 中 transcript 不可预测性假设的浮点对应物。在其方案里，低秩噪声会让对手选择的输出变得便宜（当 A = B = 0 时，带噪乘积就是 N_AN_Bᵀ），困难性必须建立在计算 transcript 上。本协议中，量化阻断了输出捷径，困难性可以建立在输出 tile 本身。矿工控制 A、B，可能尝试植入经加噪、量化后仍然存在的结构；第 5 节以 policy check 排除这类结构。')

h('3 预备知识',1)
p('记号。令 A ∈ R^(m×k)、B ∈ R^(n×k)，有用乘积 C := ABᵀ ∈ R^(m×n)。两个操作数均以行向量集合存储。因此 C_ij 是 A 的第 i 行和 B 的第 j 行的内积，故 B 有转置。对选定行索引集合 I_A、I_B，A_I_A 与 B_I_B 分别表示相应的行条带；索引集合无重复，条带按升序排列。所有行、列索引从零开始。')
p('seed noise_seed_A、noise_seed_B 决定带噪操作数 Ã、B̃。验证者重算的带噪 tile 为 C̃_I_A,I_B := Ã_I_A(B̃_I_B)ᵀ。I_A 索引 C̃ 的行，I_B 索引其列。ticket digest 是从 tile 到 {0,1}^λ 的带键函数 Ticket，λ = 256。P_A、P_B 是分别覆盖 A、B 行的模式，也即覆盖 C̃ 行、列的模式，例如周期性连续块划分。它们还决定 tile 内各元素进行哈希时的分组和顺序。随机性提取函数 Extract 会把 tile 高效压缩为依赖每个元素的 64 字节共识编码：')
eq('3')
p('区块链状态和状态窗口。POW 必须绑定链上状态，避免状态确定之前预先计算或跨区块复用工作。基础设定下，矿工把承诺绑定到其提议的区块头，而该区块头再承诺当前 tip。以待提议区块为相对深度编号：σ₀ = σ 为待提议区块头，σ̂₁ 是其父块（当前 tip），σ̂₂ 是祖父块，以此类推；上下文 Σ 携带这些区块头。共识允许深度为 D 的状态窗口（如 D = 3）：矿工可将 B 的承诺绑定到窗口内任一 σ̂₀,…,σ̂_D−1，但 A 的承诺仍绑定到 σ̂。')
p('域分离哈希。令 q 为 32 字节 parent key，ℓ 为域分离字符串，例如 “jackpot”。文中展示的每个 label 都省略了隐含的协议版本。实际 label 同时包含协议版本和此处展示的角色名。BLAKE3 只接受一个 key，因此 q 放在其 key 位；角色 ℓ 的 key 定义为 Subkey(q,ℓ) := BLAKE3(ℓ; key=q)，再令 H_ℓ(x;q) := BLAKE3(x; key=Subkey(q,ℓ))。若无从 transcript 导出的 parent key，则使用未带键的 BLAKE3(ℓ) 而非 Subkey，即 H_ℓ(x) := BLAKE3(x; key=BLAKE3(ℓ))。这样可保留域分离接口，但不承诺 key 的不可预测性。')
p('工作模型。工作量按 MAC 计量。选定 tile 的直接成本为 T_tile := |I_A|·|I_B|·k。采用 MAC 仅为明确起见；任意计算模型都可使用，其中 T_tile 应理解为该模型下 tile 的成本。MAC 计数仅固定尺度，刻意不包括量化、生成噪声、哈希、验证承诺及内存移动的工作。')

h('4 明文验证者',1)
h('4.1 验证者概览',2)
p('验证者只检查 matmul 的一个 tile，而非整个乘积。证明为该 tile 命名，并只携带此 tile 所读取的数据。附录 A 给出可选 MoE 验证者，路由在其中概念上属于 A；附录 B 给出两种模式的 ZK 验证者。')
p('1. 接收条带。证明携带 A、B 的选定行；被选中的 B 行成为输出 tile 的列。\n2. 检查树并导出 seed。条带附带最小 Merkle multiproof。验证者由条带及证明重算 A、B 的根，任何不一致均拒绝；再由 B 的根和链状态导出 noise_seed_B，并由 noise_seed_B 和 A 的根导出 noise_seed_A。seed 位于承诺之后，因此矿工不能挑选自己的噪声。\n3. 给条带加噪并计算 tile。seed 展开为两条带的噪声，得到 Ã、B̃。验证者运行矿工所用 kernel 计算 C̃ = Ã(B̃)ᵀ，因此双方 tile 可逐比特一致。\n4. 检查难度。验证者计算 ticket digest Ticket(C̃)，这是以 noise_seed_A 的域分离派生值为 key 的 32 字节值。仅当其不高于有效 target 时 tile 才获胜；有效 target 按 T_tile 缩放。\n5. 检查条带。验证者对两条带运行 jackpot policy，决定该 tile 是否是足够丰富的 matmul 工作。')
h('4.2 公共参数',2)
p('m、n、k 为公开维度。证明还提供噪声秩 r、Quant、Device、两个操作数的 hash_id_A、hash_id_B，以及矿工选择的周期性分区 P_A、P_B。每个 hashing identifier 从共识允许列表中选择，精确规定哈希方式，特别是 BLAKE3 的内部 chunk size。每个分区把操作数行划为条带，从而把整个 A·B matmul 确定性拆为许多独立 matmul；每个 matmul 含固定数量的 A 行和 B 行。分区由沿轴重复的短 pattern 表示，各条带形状相同且互不重叠。pattern 仅需数个字节，base 只有落在该 pattern 网格上才有效。')
p('Device 和 Quant 都是共识允许列表中的枚举。Device 指定 GPU 架构，Quant 指定量化方案。本文规定一种量化方案：附录 C.6 的 FP10 commit type 配合附录 C.4 的 noisy quantization。最后，e 为 MoE 扩展中的 expert 数量（附录 A）；普通矩阵乘法取 e := 0。两个操作数的公共参数元组为：')
eq('4')
h('4.3 Tile 计算',2)
p('两个 seed 产生后，矿工从每个分区各选一个条带，以 base t_A、t_B 标识。令 I_A := Rows(P_A,t_A)、I_B := Rows(P_B,t_B)，即 t_A、t_B 对应条带中按升序排列的行。分区还决定 Extract 如何把 tile 值排入 jackpot hash 的 64 字节输入：tile 被拆成 16 个 subtile，Extract 将每个 subtile 的 FP32 bit pattern 经混合折叠为一个 32-bit word，使每个 tile entry 都影响 digest。例如对 subtile 条目 x，有 w ← rotl_13(w·c + bits(x)) mod 2³²，其中 c 为奇数常量，bits(x) 是 x 的 32-bit 编码。')
h('4.4 证明内容',2)
p('区块链上下文提供 Σ := (σ̂,σ̂₁,…,σ̂_D−1)，其中 σ̂_j 是已认证的相对深度 j 的祖先区块头；σ̂、σ̂_j 均不含证明承诺。若证明携带的 σ̂_d 不在 Σ 内，验证者拒绝。证明携带：(1) 选定祖先区块头 σ̂_d；(2) 公共参数元组 p_A、p_B；(3) 两个周期分区的 tile base t_A、t_B；(4) opening π_A、π_B，其中包含覆盖干净 A、B 条带的叶子及其 Merkle sibling hash。证明不包含根 H_A、H_B、noise seed、noise factor、带噪条带、乘积 tile、extractor 输出或 jackpot hash。')
h('4.5 接受规则',2)
p('以下给出逻辑接受规则；字节编码和证明序列化不在本文规定范围内。MoE 情况只替换附录 A 所列规则。下列任一操作失败，验证者都拒绝。')
p('1. 验证上下文和公开参数。运行 CheckPublic(Σ,σ̂_d,p_A,p_B,t_A,t_B,π_A,π_B)。它检查待提议区块头 σ̂ 的父块是否接入区块链、认证 σ̂_d 是否属于 Σ，并验证区块头其他链字段；同时检查 p_A、p_B 的基本有效性并要求 e=0。尤其要求 1≤m,n≤2²⁴、1024≤k≤2¹⁶、r=32、32|k，且 I_A⊆{0,…,m−1}、I_B⊆{0,…,n−1}。若 b_A×b_B 是由 P_A、P_B 确定的 Extract 32-bit word array 形状，则要求 b_A·b_B=16、|I_A|≥4、|I_B|≥16、256≤|I_A|·|I_B|≤2048；为性能起见，还要求 k·(|I_A|+|I_B|)≤2²²。')
p('2. 验证 opening。以 σ₀ := σ̂，导出 key_B := H_“key-B”(σ̂_d)、key_A := H_“key-A”(σ̂)。对 X∈{A,B}，计算 (H_X,X_I_X) := VerifyOpen(π_X;key_X,p_X,I_X)。VerifyOpen 检查 π_X 恰好打开 I_X；它以 key_X 作为 hash_id_X 的 key，要求给定操作数形状和 hash_id_X 下唯一的最小叶子集及 sibling hash，重建 Merkle 根并返回根 H_X 与干净条带 X_I_X。打开值必须采用 Quant 指定编码；X_I_X 以该编码返回，解码是第 4 步 NoisyQuantize 的第一步。NaN、infinity 均被拒绝，subnormal 可接受。')
p('3. 导出噪声 seed：noise_seed_B := H_“seed-B”(H_B,key_B,p_B)，noise_seed_A := H_“seed-A”(H_A,noise_seed_B,key_A,p_A)。')
p('4. 重算 ticket。验证者为所有 E、F 行使用共识映射 SampleLine。给定 seed noise_seed_X、操作数 X∈{A,B}、factor Z∈{E,F} 和行索引 ℓ，SampleLine 返回长度 r 的 FP8 E4M3FN 行。该映射确定且与抽取顺序无关；每一行仅由 (X,Z,ℓ) 定址，输出行的欧氏范数约为 256（构造见附录 C.3）。令 s_X := noise_seed_X，计算 E_X[ℓ,:] := SampleLine(s_X,X,E,ℓ)，ℓ∈I_X；F_X[u,:] := SampleLine(s_X,X,F,u)，0≤u<k。堆叠后，E_X∈FP8^(|I_X|×r)、F_X∈FP8^(k×r)，每个条带取得恰在打开行上展开的秩 r 噪声 E_XF_Xᵀ。随后计算：')
eq('5')
eq('6')
p('NoisyQuantize 见附录 C.4。规定的所有浮点运算的中间值都必须是有限数；NaN、正无穷或负无穷都会导致拒绝。')
p('5. 应用 policy 与 target。令 τ 为 σ̂ 所规定的 target difficulty。仅当 JackpotPolicy(I_A,A_I_A,I_B,B_I_B;σ̂,σ̂_d,p_A,p_B,H_A,H_B)=approve，且 uint256_LE(J)≤τ·|I_A|·|I_B|·k 时接受。  (11)(12)')
h('4.6 验证者设计理由',2)
p('Opening。验证者按一个操作数形状、hash_id 和 key 解释每个根。最小 Merkle proof 对应一组预期叶子和 sibling hash；这避免证明填充，并在算术开始前限制输入。opening 只认证披露行，并不证明知晓未披露矩阵条目。打开值使用 Quant 选定编码；拒绝 NaN 和 infinity 可排除异常算术输入。')
p('状态窗口。B 承诺可使用状态窗口内任一 σ̂_d，相比只用 σ̂₀，最多给 B 侧 D 倍的预处理机会。对有用矿工而言，区块链 tip 变化后，同一窗口也给其最多 D−1 个区块间隔来替换矩阵，不必立刻替换。A 承诺则使用并绑定待提议区块头。')
p('挑战顺序。seed 链固定了预期的 Fiat–Shamir 顺序。矿工获得 noise_seed_B 前必须固定 B 和 p_B；之后可选择 A，但获得 noise_seed_A 前必须固定 A 和 p_A。因此 A 可依赖第一个挑战，不能依赖第二个。每个 seed hash 包含 p_X，故操作数维度、噪声秩、Quant、Device、hash identifier 和分区均被绑定到对应噪声挑战。这些绑定并不能阻止 transcript grinding 或跨承诺、跨深度共享工作；批处理和 grinding 的安全定义必须计入这些选择。')
p('哈希域。标签 “key-A”“key-B”“seed-A”“seed-B” 将操作数角色和 transcript 阶段分开。sampler 使用由 seed 派生的 key，以及带类型的地址 (X,Z,ℓ) 作为消息；这使随机访问确定，抽样顺序无关。seed 已绑定 k、r，地址中无需重复。标签 “noise-line” 与 “jackpot” 从同一 seed 派生不同 key。')
p('算术和提取。Quant 固定 commit type、量化类型、量化算法以及 round_BF16→BF16；Device 固定剩余算术。这样区分是必要的，因为仅有 E4M3FN 操作数无法决定所有设备上的逐比特一致结果。精确复现 GPU matmul 必须固定舍入方向、subnormal 处理和累加顺序。Badash、Boneh、Komargodski 与 Srivastava [5] 已刻画这些行为，并在 GPU 外复现；协议使用的是指定浮点操作，而不是理想实数算术，非有限中间结果会验证失败。')
p('难度和资格。按 |I_A|·|I_B|·k 缩放 target，使预期获胜次数与被检查 tile 的直接 MAC 成本成正比。tile 上限限制验证者工作量；下限保证向 Extract 输入足够熵。第 5.1 节 policy 决定 tile 是否有资格，target 决定合格 tile 的获胜率。')

h('5 Jackpot policy',1)
p('除第 2 节的理想设定外，协议还必须在 A、B 不为零且算术为具体浮点格式时保持安全。这带来攻击面，验证者用一组逐点检查接受或拒绝单个 lottery tile，称为 jackpot policy。')
h('5.1 Policy checks',2)
p('只有以下所有检查通过，policy 才批准。它在验证者已拒绝 Infinity/NaN 输入或中间结果之后运行。令 i∈I_A 表示 A 的一行，j∈I_B 表示 B 的一行，u（0≤u<k）表示列。A_iu、B_ju 表示逐行归一化到量化单位后的值。每行噪声 scale 为 δ:=1/2，σ_i^A:=δℓ₂(A_i)，σ_j^B:=δℓ₂(B_j)。因此每一行收到的噪声 scale 都是该行 ℓ₂ scale 的固定比例 δ，预期噪声/信号比对所有行相同。X 的噪声 N^X 已带逐行 scale，ℓ₂(N_i^X)约为 σ_i^Xℓ₂(X_i)，单条目的边缘分布约为 N(0,(σ_i^X)²)。matmul 的操作数是 Ã_iu:=Q(A_iu+N^A_iu)、B̃_ju:=Q(B_ju+N^B_ju)。')
p('令 c_ij,t 为附录 C.2 前 t 个 group 后的 FP32 accumulator，G=k/32 为 group 数。replay magnitude 定义为 M_ij := max{ max_(0≤u<k)|Ã_iuB̃_ju|, max_(1≤t≤G)|c_ij,t| }，即重放 cell (i,j) 的累加过程并记录任一单项或部分 accumulator 中出现的最大量级；ulp_Device(M_ij) 是该量级上累加网格的间距。iju summand 的不可预测性定义为：')
eq('7')
p('除固定分母外，分子相乘的是带噪条目 A_iu+N^A_iu 与 B_ju+N^B_ju 的二阶矩；v_iju 因而跟踪噪声 seed 变化时该 summand 的离散程度。unpredictable-summands 检查会把此离散程度与它所遇到的 accumulator grid 比较。常数取 τ_idle:=8、ε_idle:=1/64、σ_min:=1、τ_tame:=256、ε_tame:=1/64、ε_pred:=1/16。以下文字以实数算术表述，实际验证者实现为准。')
h('5.1.1 条目活性',3)
p('两侧的 idle entry 集合定义为 D_A:={(i,u): |A_iu|≥τ_idle σ_i^A}，D_B:={(j,u): |B_ju|≥τ_idle σ_j^B}。idle entry 比其行噪声 scale 至少大 τ_idle 倍，注入噪声的标准差最多为该条目幅值的 1/τ_idle，量化值在很大程度上可预测。要求 |D_A|≤ε_idle|I_A|k，|D_B|≤ε_idle|I_B|k。')
h('5.1.2 噪声下限',3)
p('要求 σ_i^A≥σ_min（对所有 i∈I_A）且 σ_j^B≥σ_min（对所有 j∈I_B）。这些 scale 以 A、B 的量化单位表示，因此该下限要求每个打开行至少带有一个量化单位的噪声。')
h('5.1.3 受抑制乘积',3)
p('令 ufp_Device(x)=ulp_Device(x)·2^W_Device，为不超过 |x| 的最大 2 的幂。定义 M_ij 异常高的 tile 部分：U:={(i,j): ufp_Device(M_ij)>τ_tame√k σ_i^Aσ_j^B}⊆I_A×I_B。√kσ_i^Aσ_j^B 是长度 k、summand 具有独立噪声 scale 的 dot product 的自然尺度。若一个 cell 高出该尺度 τ_tame 倍，表示两行异常一致，其乘积中噪声相对占比过小。要求 |U|≤ε_tame|I_A||I_B|。')
h('5.1.4 不可预测 summand',3)
p('定义 S:={(i,j,u): v_iju < ulp_Device(M_ij)²}。  (14) 要求全 tile 满足 |S|≤ε_pred k|I_A||I_B|。验证者实现略偏离 (14)：以 v_iju 的近似下界替代 v_iju，因此 policy 略为严格；完整细节见附录 C.5。')
h('5.2 攻击向量',2)
p('退化算术。遇到 NaN 或 infinity 时，设备算术不再像 R 上的算术：NaN 会传播至后续操作，infinity 会吸收后续有限 summand。被推入非有限状态的 tile 因此可由少量输入预测。验证者禁止输入操作数和全部中间结果出现 NaN、infinity，使被接受 tile 保持在第 5.1 节检查所建模的范围内。')
p('噪声 seed grinding。seed 虽不可预测，但矿工可 grinding，寻找会带来更快乘法的 noise factor 结构。因此，F_A、E_B、F_B 中能带来显著加速的结构必须足够罕见，令寻找它的预期 grinding 成本不现实。k≥1024、|I_B|≥16 服务于此要求。E_A 的阈值可更宽松，因为 E_A 从 A、B 两侧承诺导出，而 F_A、E_B、F_B 仅由 B 承诺导出，这一不对称也解释了某些检查对两侧的不同处理。例如，若 grinding 使同一 I_B 内 E_B 的两行相同，I_A×I_B 的 jackpot 成本会从 k|I_A||I_B| 变成 k|I_A|(|I_B|−1)，但加速倍数 |I_B|/(|I_B|−1)<1.1，考虑到 SampleLine 约有 150 bit min-entropy，仍可接受。类似地，若 B_ij=1，量化会让约 10% 条目满足 Q(B_ij+(E_BF_Bᵀ)_ij)=B_ij；在 k≥1024 时，对整块 tile grinding 出显著更高比例仍不现实。')
p('无噪声条目。矿工可承诺其条目远大于逐行噪声 scale 的操作数；量化会吸收大部分噪声，这类条目的量化值只会在少数相邻 FP8 code 之间变化，因此大部分 Ã、B̃ 及其每个 tile 都可在 seed 产生前预测。entry-liveness 检查限制两侧这类条目的比例。仅依赖 δ，也可先验上界噪声无关条目的比例，但估计通常较松。')
p('低局部熵。矿工可构造 peak entry 远大于典型条目的行。附录 C.4 的行归一化必须给 peak 留空间，使其余条目和噪声都被压缩到接近零，量化噪声只剩少数小 FP8 值。如此低的局部熵会诱发专用硬件：针对缩小值域的电路可比通用 FP8 kernel 更快乘法，破坏工作模型对 MAC 成本的假定。noise-floor check 要求每个打开行的噪声 scale 至少为 σ_min，从而排除此选项。')
p('一致 dot product。当 A 的一行与 B 的一行对齐，dot product 会集中：replay magnitude M_ij 随一致性增大，而噪声仍处在自然尺度 √kσ_i^Aσ_j^B 附近。累加网格随 cell 中最大量级变化，因此在一致 cell 中，噪声影响的保留 bit 更少，更多精确 bit 仅由 signal 即可预测。tamed-products check 限制这类 cell 的比例；τ_tame 的设定让典型 AI 工作负载可轻松满足。')
p('不可预测性。unpredictable-summands check 针对一种挖矿策略：安排 matmul，使设备累加截断噪声，仅留下可快速低秩修正的项。对 X∈{A,B}，写 S^X_iu=X_iu+N^X_iu，T^X_iu:=X̃_iu−S^X_iu。则 C̃_ij=Σ_u(S^A_iu+T^A_iu)(S^B_ju+T^B_ju)。若矿工选择低秩 A、B，S^A、S^B 也至多增加 r 秩，所有含低秩 factor 的展开项都很便宜，真正昂贵的仅为 Σ_(u=0)^(k−1)T^A_iu·T^B_ju。对不远大于 ℓ₂(A_i) 的 A_iu，当 noise seed 变化时，T^A_iu 的边缘分布方差与 (A_iu)²+(σ_i^A)² 线性相关，常数约为 2^(−10.5)。该检查确保式中除很小比例外的 summand 都不会被设备截断，都会影响最终 dot product C̃_ij。')

h('6 有用矿工概览',1)
p('本节说明诚实有用矿工的预期流程：矿工维护任务队列，每项任务是一对实矩阵 A、B，有用乘积 C=ABᵀ；并将以下步骤与普通工作负载交错执行。')
p('1. 预量化：以 commitment format（FP10）编码 A、B。协议不强制编码流程，附录 C.6 给出建议构造。\n2. 承诺：使用以近期区块头为 key 的 hash_id_B 对 B 哈希并导出 noise_seed_B；再在待提议区块头下承诺 A，导出 noise_seed_A。\n3. 加噪与量化：从 seed 导出 E_X、F_X，计算 X̃=NoisyQuantize_p_X(X,E_X,F_X)，X∈{A,B}。其成本为 O((m+n)kr) MAC，外加对操作数的一次遍历。\n4. 相乘：对完整带噪操作数运行一次 MatMul_Device。这是主导成本 mnk MAC，也是任务原本使用的 kernel，只是操作数被扰动。\n5. 扫描获胜者：按 P_A、P_B 将输出切为 tile；为每个 tile 计算 extractor 输出和 jackpot hash，再与按比例缩放的 target 比较。每个 tile 的获胜概率与成本 T_tile 成正比，因此每项任务的预期胜出数与其总 MAC 成本成正比。未获胜 tile 被丢弃，不披露任何内容。\n6. 获胜后 opening：对通过 jackpot policy 的获胜 tile，组装第 4.4 节规定的证明。')
p('恢复有用乘积。上述流程计算的是 C̃=ÃB̃ᵀ，而不是 C。seed 已知后，矿工可低成本重构二者之差：signal-noise cross term 含秩 r factor，成本为 O((mn+mk+nk)r) MAC，另加量化带来的逐行反缩放。无法消除的是包含量化误差的项（式 15），其量级与直接把 A、B 量化到 FP8 引入的误差相同。因此矿工以带噪乘积的成本加低阶修正，即可得到 FP8 级精度的有用乘积。')
p('开销核算。除乘积外，矿工要支付操作数哈希、加噪、扫描获胜 tile，以及偶尔组装证明的成本。这些都是 O((mn+mk+nk)r) MAC，或对 A、B、C̃ 的一次哈希遍历，相对 mnk 的乘积而言，当 m,n,k≫r 时总开销为 1+o(1) 因子。若 B 预先固定，其哈希与加噪只需在少数几次 blockchain-tip 变化后刷新，这会提高实际效率。')

h('7 已知挖矿加速',1)
p('若放弃有用性要求，矿工可能相对有用矿工获得加速。本节不规定缓解这些加速的护栏，只记录协议设计时已纳入考虑的高层加速类别。')
p('输入构造。无需使用乘积的矿工可以为速度而非用途选择操作数：低秩矩阵、少数 peak 主导的行、噪声会被量化抹掉的行，或高度相关的操作数行对。第 5.1 节 jackpot policy 是防线，它施加统计属性以确保不可预测性。\n精度捷径。附录 C.2 的设备算术会截断低于累加网格的 summand，矿工可跳过已知会舍入消失的 summand 并节省 MAC。第 5.1 节 unpredictable-summands check 将可跳过 summand 比例限制在 ε_pred；tamed-products check 让 cell 远离会使整组 summand 一次性消失的量级区间。\nSeed 和 commitment grinding。矿工可重试承诺以寻找有利噪声，包括 factor 中可利用结构（第 5.2 节）或更有利 transcript。每次丢弃尝试都要支付一次承诺和 seed derivation 成本，因此该类攻击受通常 Fiat–Shamir grinding 论证约束。\n工作复用。矿工可试图从一次乘法提取多个 ticket，例如将带噪输出作为新输入重新提交以串联实例，或在一批任务中摊销共享操作数、噪声或预处理。这些攻击仅在披露一个带噪 tile 会使干净 tile 的 ticket 更容易预测时才会成功。\n更好的 kernel 和硬件。若矿工借助更好的调度或芯片实现更快、逐比特一致的 MatMul_Device，它会领先其他矿工；但这也是诚实矿工获得的同类优势，不构成对协议的攻击，因为工作模型对所有人以相同单位计费。')

h('参考文献',1)
p('[1] Cynthia Dwork and Moni Naor. Pricing via processing or combatting junk mail. CRYPTO, LNCS 740, 139–147, Springer, 1992.\n[2] Satoshi Nakamoto. Bitcoin: A peer-to-peer electronic cash system. 2008.\n[3] Marshall Ball, Alon Rosen, Manuel Sabin, and Prashant Nalini Vasudevan. Proofs of useful work. IACR Cryptology ePrint Archive, 203, 2017.\n[4] Ilan Komargodski and Omri Weinstein. Proofs of useful work from arbitrary matrix multiplication. arXiv:2504.09971; IACR Cryptology ePrint Report 2025/685, 2025.\n[5] Erez Badash, Dan Boneh, Ilan Komargodski, and Megha Srivastava. Hawkeye: Reproducing GPU-level non-determinism. arXiv:2603.20421, 2026. To appear in MLSys 2026.\n[6] Jack O’Connor, Jean-Philippe Aumasson, Samuel Neves, and Zooko Wilcox-O’Hearn. BLAKE3: one function, fast everywhere. Specification, 2020. https://github.com/BLAKE3-team/BLAKE3-specs.')

h('附录 A MoE 验证者',1)
p('本附录说明在明文验证者上实现 MoE 扩展所需的改动。')
p('Expert matmul。激活矩阵为 A 的 MoE 任务具有 e≥1 个 expert；每个 expert 的右操作数有 η:=n/e 行。对 expert w，令 B^(w)∈R^(η×k) 为其右操作数矩阵，R[w] 是路由到该 expert 的 A 行的升序列表，s_w:=|R[w]|，左操作数 A^(w)_i:=A_(R[w][i])，0≤i<s_w。有用 expert matmul 为 C^(w):=A^(w)(B^(w))ᵀ∈R^(s_w×η)。一个 token 可出现在多个路由列表中，也可不出现。')
p('协议编码。协议将 expert 矩阵堆叠为 B := [B^(0); … ; B^(e−1)]∈R^(n×k)。完整堆叠作为一个矩阵承诺并加噪，因此 H_B 覆盖所有 expert；e 是 p_B 的一部分。A 侧公共参数扩展为 p_A := (m,hash_id_A,P_A,hash_id_R,hash_id_O)。令 O=(O₀,…,O_(e−1)) 编码路由列表累计长度，O_i:=Σ_(w≤i)s_w；令 Rflat:=R[0]∥…∥R[e−1]，其长度为 O_(e−1)，且 O 固定 Rflat 如何分割为各列表。以 key_A、hash_id_R 哈希 Rflat 得 H_R，以 hash_id_O 哈希 O 得 H_O。')
p('证明内容。除第 4.4 节内容外，证明还包含：(1) 获胜 expert w 及完整累计计数列表 O；(2) opening π_R，包含完整 R[w] 列表的叶子和 Merkle sibling hash。不包含根 H_R、H_O；w、t_A、t_B 均在两个 noise seed 生成后由矿工选择。约定 O_−1:=0，则 |R[w]|=O_w−O_(w−1)，区间 [O_(w−1),O_w) 对 w=0 也有定义。')
p('验证者改动。1. CheckPublic 接受扩展 p_A、接收 w、O、π_R，以 1≤e≤1024、e|n、0≤w<e 替换 e=0。要求 |O|=e、0≤O₀≤…≤O_(e−1)、|R[w]|=O_w−O_(w−1)=s_w，并要求 R[w] 在 [0,m) 内严格递增；不验证其他路由列表。两个 pattern 在 expert 局部坐标中表示：U_A:=Rows(P_A,t_A)⊆{0,…,s_w−1}，I_A:=R[w][U_A]；U_B:=Rows(P_B,t_B)⊆{0,…,η−1}，I_B:=wη+U_B。分区 base 与 extract layout 检查使用 U_A、U_B，全球行界检查使用 I_A、I_B；映射保持基数，因此原 tile-shape 约束不变。')
p('2. 验证 opening。验证者将 Rflat 视为恰有 O_(e−1) 个 token index；以 key_A、hash_id_R，π_R 最小打开 Rflat 的 [O_(w−1),O_w) 并重建 H_R，规则与 π_A、π_B 相同。再用 hash_id_O 和 key_A 哈希提供的 O 得 H_O，随后按 I_A、I_B 验证 π_A、π_B。\n3. 导出 noise seed。保留式 (10) 的 B 侧，A 侧改为 noise_seed_A:=H_“seed-A”(H_A,H_R,H_O,noise_seed_B,key_A,p_A)。因此 e 在 noise_seed_B 前经 p_B 固定；此后扩展 p_A、H_R、H_O 与 A 均在 noise_seed_A 前固定。\n4. 重算 ticket。对 i∈U_A、j∈U_B，采样 E_A[R[w][i],:]:=SampleLine(noise_seed_A,A,E,R[w][i])，E_B[wη+j,:]:=SampleLine(noise_seed_B,B,E,wη+j)。E 行只依赖 global index，F 行只依赖 k 维，因此噪声在全局上规范；矿工可只对 A 加噪量化一次并在 expert 间复用。既有 NoisyQuantize、MatMul_Device、Extract 和有限性检查不变。\n5. 应用既有 jackpot policy 与 target difficulty。')

h('附录 B ZK 验证者',1)
p('外层验证者和 ZK verification circuit 共同执行第 4 节的接受规则；e≥1 时还包括附录 A 的改动。每项明文条件均保持不变。本附录只规定 witness 的披露边界和 ZK wrapper。')
p('公开输入。令 p_ZK 包含 ZK proof system 特有的全部公共参数。共同公开输入元组为 X:=(p_ZK,σ̂,σ̂_d,p_B,p_A,H_B,H_A,t_B,t_A,J)。当 e≥1 时，追加 (H_R,H_O,w,O_(w−1),O_w,O_(e−1),I_A)；当 e=0 时不追加。派生值不携带：非 MoE proof 由式 (3) 导出 I_A、I_B；MoE proof 由附录 A 导出 η、s_w、U_A、U_B、I_B；两种模式也都会导出 key、noise seed、noise value 及 target。')
p('私有 witness。witness 包含 A_I_A、B_I_B 和完整最小 opening π_A、π_B。MoE witness 还包含全部 O、R[w] 以及 π_R（R[w] 的所有叶子和 sibling hash）。带噪条带、乘积 tile、extractor 输出和 jackpot-policy 中间量也均为私有。')
p('与明文验证的差异。1. 绑定 statement。外层验证者拒绝不允许的 p_ZK 值并选择相应 circuit。定义 H_pub:=H_“zk-public”(X_ZK)，ZK Fiat–Shamir transcript 在第一个 challenge 前吸收 H_pub。2. 拆分验证。外层验证者认证 proof 携带的 σ̂_d 位于链上下文 Σ，并完成所有 public-input check；它完成所有协议级 Fiat–Shamir derivation、计算 noise，并在验证 ZK proof 前应用 target check (12)。verification circuit 完成一切依赖私有数据的检查，并约束公共 J 等于由该私有数据算出的 jackpot hash。3. 参数化隐藏的 MoE opening。MoE 中 O_(w−1)、O_w 标识 Rflat 被打开的区间，O_(e−1) 固定其总长度；公开 I_A 固定 A 的打开行，w、t_B 固定 B 的打开行。circuit 检查 O 对 H_O 有效，检查 R[w]、π_R 对 H_R 有效，并强制 I_A=R[w][U_A] 等全部公开值一致。')

h('附录 C 验证者算术规范',1)
p('本附录规定验证者相关程序和算术：1) FP32、BF16、FP8 算术、转换及 E4M3FN 矩阵乘法；2) 量化程序（附录 C.4）及 commit type（FP10，附录 C.6）；3) 噪声行 sampler（附录 C.3）；4) 不可预测性规范（附录 C.5）。其中矩阵乘法随已承诺硬件而定，量化取决于 Quant，采样和不可预测性程序建立在前述操作之上。')
h('C.1 浮点算术',2)
p('首先规定除矩阵乘法外的 FP32、BF16、FP8 算术。这些按元素操作不涉及累加顺序，因此在所有 Device 上相同。验证者拒绝 NaN、infinite 操作数，也拒绝结果不为有限数的操作，即目标类型 FP32 或 BF16 的舍入结果为 infinity 或 NaN 编码。检查在舍入后进行，因此刚低于最大有限幅值但会舍入到 infinity 的值也被拒绝，且绝不会产生 NaN 编码。')
p('• Casting：提升到 FP32 很直接，因为 BF16、E4M3FN 可精确表示于 FP32。降转换到 T∈{BF16,FP8} 使用 RNE_T（nearest，ties-to-even）。E4M3FN 中 |x|>464、会舍入到幅值 480 或更高的结果，饱和为最大有限幅值 448.0（code 0x7E）；tie |x|=464 在 ties-to-even 下舍入为 448。BF16 overflow 被拒绝。\n• 二元操作：Mul、Div 均按 IEEE 754-2019 在 FP32 中计算再降转换：Mul_BF16(a,b):=RNE_BF16(RNE_FP32(ab))；Div_BF16(a,b):=RNE_BF16(RNE_FP32(a/b))。\n• Min、Max：精确比较并不经舍入地返回一个操作数；相等时（含 +0、−0）返回第一个操作数。\n• Clamp：对 Q>0，clamp(x,−Q,Q):=Max_BF16(Min_BF16(x,Q),−Q)。\n• FMA：FMA_BF16(a,b,c):=RNE_BF16((a×b)+c)，将精确值一次舍入到 BF16（IEEE 754-2019 fusedMultiplyAdd）；不同于 Div，它不是在 FP32 中计算后再降转换。')
h('C.2 E4M3FN 矩阵乘法',2)
p('对 U∈FP8^(a×k)、V∈FP8^(b×k)，opcode MatMul_Device(U,V) 把 FP32 矩阵 UVᵀ 累加到 FP32 accumulator。非零有限 E4M3FN code x 的 sign s∈{−1,1}、exponent field e∈{0,…,15}、fraction m∈{0,1/8,…,7/8}，其值为 x=s·m·2^(−6)（e=0）或 s·(1+m)·2^(e−7)（e>0）；stored exponent ε(x) 分别为 −6 或 e−7。非零 FP32 的 stored exponent 为 exponent field 减 bias，normal c 时 ε(c)=⌊log₂|c|⌋，subnormal 时为 −126；零没有 exponent，在下述最大值中跳过。')
p('按照 [5]，每个 32 项 dot-product group 的计算如下：1) U_iuV_ju 的 products 精确计算；2) accumulator 内部 mantissa precision W_Device 依架构而定（Hopper 例为 13，Blackwell 为 25），exponent 范围 [−126,127]；mantissa 不含隐含的 leading 1，故 Hopper 的 14-bit、Blackwell 的 26-bit significand 分别对应 W=13、25，FP32 为 23；3) 每组固定大小（如 32）求和：将 products 与 accumulator 按 exponent shift 对齐，向零截断到内部精度，相加后再次向零截断；4) 每个 product 的 exponent 是其操作数 stored exponent 之和，不重新正规化，exponent shift 是 group 内非零 product 和 accumulator 的最大 stored exponent；subnormal input 不重新正规化；5) 若 W_Device>23（Blackwell）则向零舍入至 FP32，Hopper 因内部精度较低无需额外舍入。')
eq('8')
p('若 S=0，返回 +0；否则 c←Trunc(S,2^(⌊log₂|S|⌋−W))。若 W_Device>23，再以 2^(⌊log₂|c|⌋−23) 向零截断。非零 sum 永不会舍入为零，因为条目为 E4M3FN。')
h('C.3 噪声行 sampler',2)
p('令 r 为噪声秩，X∈{A,B} 为操作数，Z∈{E,F} 为 factor，ℓ 为行。令 noise_key_X:=Subkey(noise_seed_X,“noise-line”)。从 BLAKE3 XOF 抽取该行 r 个字节：(b₀,…,b_(r−1)):=BLAKE3-XOF((X,Z,ℓ);key=noise_key_X)[0:r]。每个 b_u∈{0,…,255} 拆成 top bit s_u∈{0,1} 与 low seven bits m_u∈{0,…,127}，b_u=128s_u+m_u，并令 x_u:=(-1)^s_u(1+m_u)，因此 x_u 在 ±{1,…,128} 上均匀。')
p('令 q:=isqrt(32²Σ_u x_u²)，γ:=Div_BF16(8192,RNE_BF16(q))。q 约为 32√Σx_u²，乘以 γ=8192/q 会在最终舍入至 FP8 前把行重缩放到约 8192/32=256 的欧氏范数。以 c:=256 表示此 target norm：SampleLine(noise_seed_X,X,Z,ℓ):=RNE_FP8(Mul_BF16(x_u,γ))。x_u 为整数，可由 BF16 精确表示。BLAKE3 是 XOF，除默认 256-bit digest 外可输出任意长度字节流，其前 32 字节与默认 digest 相同。')
h('C.4 Noisy quantization',2)
p('令 X∈BF16^(s×k) 为 operand strip，依附录 C.6 从承诺 FP10 matrix 解码；E∈FP8^(s×r)、F∈FP8^(k×r) 为 noise factor。本节定义 NoisyQuantize_p(X,E,F)=X̃∈FP8^(s×k)，并固定每行 scale α_t 和 floored norm ℓ̂₂(X_t)，第 5.1 节会以 X_t=α_tX_t 和 σ_t^X=δα_tℓ̂₂(X_t) 使用它们。α_t、β_t 也供矿工剥离噪声、恢复有用乘积，但恢复不是协议的一部分。')
p('概览。量化按行进行。每行 t 的 X 及其 noise row N_t:=(EFᵀ)_t 被缩放、相加：X̃_t≈α_tX_t+β_tN_t，再舍入至 FP8。α_t、β_t>0 被选择为：(1) α_tX_t+β_tN_t 的每个条目均在 FP8 范围 [−Q,Q]；(2) noise row 欧氏范数为缩放行的 δ 倍，即 ||β_tN_t||₂=δ||α_tX_t||₂。noise line 的范数为 c，|N_tu|≤c²，随机情况下 N_t 的 RMS entry 约为 c²/√r。写 ℓ₂(X_t) 为 RMS entry、ℓ∞(X_t) 为最大幅值，则 β_t=α_tℓ₂(X_t)δ√r/c²，约束 (1) 化为 α_t(ℓ∞(X_t)+δ√rℓ₂(X_t))≤Q，取等号以定 α_t。注意：N_t 的范数从不实测，约束 (2) 只以高概率近似成立；约束 (1) 在精确算术中成立，但舍入可能略越过 Q，定义中的 clamp 处理该情形。')
p('定义。范数 ℓ₂(X_t)、ℓ∞(X_t) 从 X 的 committed representation 而非 BF16 decoding 计算（附录 C.6）。ℓ₂ 是 RMS entry，||X_t||₂=√kℓ₂(X_t)，并非 noise line 所用的欧氏范数。两种范数都下限为 2^(−32)：ℓ̂₂=max{ℓ₂,2^(−32)}，ℓ̂∞=max{ℓ∞,2^(−32)}。固定 Q=448、δ=1/2、c=256。精确算术中：α_t=Q/(ℓ̂∞(X_t)+δ√rℓ̂₂(X_t))，β_t=α_tℓ̂₂(X_t)δ√r/c²，X̃_t=RNE_FP8(α_tX_t+β_tN_t)。')
p('逐比特计算。令 d_r:=RNE_BF16(δ√r)，e_r:=RNE_BF16(δ√r/c²)，均由精确实数舍入。以下每个操作均为附录 C.1 的 BF16 操作，所有 +、·、/ 都把结果舍入到 BF16；括号固定求值顺序，未加括号的 a·b+c 表示一次舍入的 FMA_BF16：z_t:=d_r·ℓ̂₂(X_t)+ℓ̂∞(X_t)；α_t:=Q/z_t；β_t:=α_t·ℓ̂₂(X_t)·e_r；N:=RNE_BF16(MatMul_Device(E,F))；y_tu:=α_t·X_tu+β_t·N_tu；X̃_tu:=RNE_FP8(clamp(y_tu,−Q,Q))。Q=448 是最大有限 E4M3FN 幅值，clamp 因而保证每个量化值都可表示。对于 r≤4096，实现以 double precision 求值并经 FP32 舍入，这与对精确值的一次舍入一致。')
h('C.5 不可预测性规范',2)
p('回顾第 5.1 节。M_ij 是 cell (i,j) accumulation 中出现的最大幅值。量级 x 的 accumulation grid spacing 为 ulp_Device(x):=2^(⌊log₂|x|⌋−W_Device)，ulp_Device(0):=0。summand (i,j,u) 的不可预测性为 v_iju=((A_iu²+(σ_i^A)²)(B_ju²+(σ_j^B)²))/2²¹。要计数的集合是 S:={(i,j,u):v_iju<ulp_Device(M_ij)²}。')
p('为效率，验证者在 log domain 用 fixed-point integer 判断不等式。对 v_iju 的两个因子分别计算 Λ(x,σ)≈log₂(x²+σ²)，这是精度在 0.016 以内的下界。令 Λ_iju:=Λ(A_iu,σ_i^A)+Λ(B_ju,σ_j^B)−21，则 Λ_iju≤log₂v_iju<Λ_iju+0.032，−21 来自 log₂2²¹。实现改为统计 Ŝ:={(i,j,u):Λ_iju<log₂(ulp_Device(M_ij)²)}。由于 Λ_iju 是下界，Ŝ⊇S；仅当 ulp_Device(M_ij)²≤v_iju<2^0.032·ulp_Device(M_ij)² 时，summand 才会落在 Ŝ\\S。')
p('Λ(x,σ) 的估计。先取较大 exponent e:=max(⌊log₂|x|⌋,⌊log₂σ⌋)，写 x=2^e m_x、σ=2^e m_σ，使 |m_x|、m_σ 较大者在 [1,2)，另一个在 [0,2)。则 x²+σ²=2^(2e)(m_x²+m_σ²)，且 m_x²+m_σ²∈[1,8)。再以 13 个 fractional bit 计算显著数平方和整数 κ:=⌊(⌊2³⁰m_x²⌋+⌊2³⁰m_σ²⌋)/2¹⁷⌋∈[2¹³,2¹⁶)。最后取 6 个 fractional bit 的 log：Λ(x,σ):=2e−13+⌊64log₂κ⌋/64。κ 是 m_x²+m_σ² 的向下近似，因此 Λ≤log₂(x²+σ²)。κ truncation 损失小于 2^(−12)，最终 floor 损失小于 2^(−6)，总误差小于 0.016，故 log₂(x²+σ²)−0.016<Λ(x,σ)≤log₂(x²+σ²)。两个估计相加再减 21，即得 Λ_iju 的界。由于 C.4 的 norm floor 使 ℓ̂₂≥2^(−32)、σ>0，x=σ=0 不会出现，估计始终有定义。')
h('C.6 Commit type FP10',2)
p('含 n 行、k 为 8 的倍数的操作数由两个矩阵承诺：整数值矩阵 V 和 BF16 block-scale 矩阵 Σ，其维度为：')
eq('9')
p('每行连续 8 个条目共用一个 scale，条目 (t,u) 表示实数 V_tu·Σ_(t,⌊u/8⌋)。每个条目花费 8 bit，每个 8 条目 block 花费 16 bit，即每个条目 10 bit，故称 FP10。')
p('本附录定义解码 X:=Open(V,Σ)∈BF16^(n×k)，其打开行是 C.4 的输入，并定义所用的 row norm ℓ₂(X_t)、ℓ∞(X_t)。承诺时，两个矩阵分别以 Merkle tree 对行承诺，使用第 4 节的 key 和 hash identifier。V 的一行是 k 个 two’s-complement byte；Σ 的一行是 2k/8 个 byte，每个 scale 为 little-endian BF16 code。NaN、infinite scale 被拒绝。aggregate root H_X 是两个根 R_V、R_Σ 及形状的 hash。')
p('解码：X_tu:=RNE_BF16(V_tu·Σ_(t,⌊u/8⌋))。该乘积最多 15 个 significant bit（整数 7 bit 加 BF16 significand 8 bit），可在 FP32 精确表示，X_tu 仅有一次舍入。row norm 直接由 V、Σ 而非 X 计算，令每块 b 的 S_tb:=Σ_(8b≤u≤8b+7)V_tu²，A_tb:=max_(8b≤u≤8b+7)|V_tu|；二者为整数且 S_tb≤8·127²<2¹⁷，均可在 FP32 精确表示。按 block order 累加 s_t,0:=0，s_t,b+1:=s_t,b+(S_tb·Σ_tb²)，令 s_t:=s_t,k/8；非有限 s_t 被拒绝。随后 ℓ₂(X_t):=Grid(RNE_BF16(√(s_t/k)))，ℓ∞(X_t):=RNE_BF16(max_b A_tb·Σ_tb)。Grid 将非负 BF16 的最低两个 mantissa bit 向上取整到 nearest，tie 向上，进位传播至 exponent。')

# Footer with page field
for section in doc.sections:
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.add_run('Pearl 浮点方案规范 中文译文  |  ')
    fld = OxmlElement('w:fldSimple'); fld.set(qn('w:instr'), 'PAGE')
    footer._p.append(fld)

doc.core_properties.title = 'Pearl 浮点方案规范 中文译文'
doc.core_properties.author = 'Pearl Research Team 原文 中文译文'
doc.save(OUT)
print(OUT)
