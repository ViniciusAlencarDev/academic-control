const express = require('express')
const app = express()
const path = require('path')
const nodemailer = require('nodemailer')
const crypto = require('crypto')
const cors = require('cors')

app.use(express.static(path.join(__dirname, 'public')))
app.set(path.join(__dirname, 'public'))
app.use(express.json())
app.use(cors(['*']))

const configServer = require('./config/configServer.json')
const protocol = process.env.PROTOCOL || configServer.protocol;
const ip = require('ip').address()
const port = process.env.PORT || configServer.port;

const connection = require('./database/connection')

// Rotas
app.get('/', (req, res) => {
    res.redirect('index')
})

app.post('/login', async (req, res) => {
    const { matricula, senha } = req.body;
    let response = {
        success: false
    }
    const data = await connection('professores')
        .select('*')
        .where('matricula', matricula)
        .where('senha', senha)

    if(data.length) response.success = true;
    
    res.send(response);
});

app.get('/disciplinas', async (req, res) => {
    let response = {
        success: false,
        data: []
    }
    const data = await connection('disciplinas')
        .select('*')
    if(data.length) {
        response.success = true;
        response.data = data;
    }
    res.send(response)
});

app.get('/disciplina/:id/:date', async (req, res) => {
    const { id, date } = req.params;
    const dateString = date.replace('-', '/').replace('-', '/')
    
    let response = {
        success: false,
        data: []
    }

    const prepare = await connection('frequencias')
        .select('*')
        .where('DATA', dateString)
        .where('ID_DISCIPLINA', id)
    if(!prepare.length) {
        const data = await connection('disciplinas')
            .select('*')
            .where('id', id)
        if(data.length) {
            response.success = true;
            response.data = data;
        }
    } else
        response.data = ["Frequencia de hoje já se encontra registrada!"]
    
    
    
    res.send(response)
});

app.get('/alunos', async (req, res) => {
    let response = {
        success: false,
        data: []
    }
    const data = await connection('alunos')
        .select('*')
    if(data.length) {
        response.success = true;
        response.data = data;
    }
    res.send(response)
})

app.post('/frequencia', async (req, res) => {
    const { id_disciplina, data } = req.body;
    let response = {
        success: false,
        data: []
    }
    const frequencias = await connection('frequencias').select('*')
    const id = frequencias.length + 1;

    const result = await connection('frequencias').insert({
        id,
        id_disciplina,
        data
    })
    if(id === result[0]) {
        response.success = true
        response.data = result[0]
    }

    res.send(response)
});

app.post('/marcacao', async (req, res) => {
    const { id_frequencia, marcacoes } = req.body;
    let response = {
        success: false,
        data: []
    }
    let marcacoesArray = JSON.parse(marcacoes)
    
    marcacoesArray.map(async (marcacao, key) => {
        console.log(marcacao)
        const data = await connection('marcacoes').select('*')
        const id = data.length + 1 + key;

        const result = await connection('marcacoes').insert({
            id,
            id_frequencia,
            id_aluno: marcacao[0],
            marcacao: marcacao[1]
        })
    })
    response.success = true;

    res.send(response)
});

app.get('/frequencia/:id_disciplina', async (req, res) => {
    const { id_disciplina } = req.params;
    let response = {
        success: false,
        data: []
    }
    const data = await connection('frequencias')
        .select('*')
        .where('id_disciplina', id_disciplina)
    if(data.length) {
        response.success = true;
        response.data = data;
    }
    res.send(response)
});

app.get('/marcacao/:id_frequencia', async (req, res) => {
    const { id_frequencia } = req.params;
    let response = {
        success: false,
        data: []
    }
    const result = await connection('marcacoes')
        .select('*')
        .where('id_frequencia', id_frequencia)
    //Nao traz todos os dados
    console.log(result)

    const alunos = await connection('alunos')
        .select('*')

    result.map(item => {
        item['NOME'] =
        alunos.filter(aluno => aluno.ID === item.ID_ALUNO).length ?
        alunos.filter(aluno => aluno.ID === item.ID_ALUNO)[0].NOME
        : "";
    })

    if(result.length) {
        response.success = true;
        response.data = result;
    }
    res.send(response)
})

// const transporter = nodemailer.createTransport({
//     host: "smtp.mail.yahoo.com",
//     port: 587,
//     secure: false,
//     auth: {
//         user: 'professorteste@yahoo.com',
//         pass: 'mfvvgoyvbhnvoeme'
//     }
// });

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'academiccontrol2020@gmail.com',
        pass: '123456sete'
    },
});

app.post('/recuperarsenha', async (req, res) => {
    const { email } = req.body;
    let response = {
        success: false,
        data: []
    }

    const verificar = await connection('professores')
        .select('*')
        .where('EMAIL', email)
    
    if(verificar.length) {
        // const codigo = crypto.createHmac('sha256', '123456')
        //     .update(email)
        //     .digest('hex');
        let buff = new Buffer(email);
        const codigo = buff.toString('base64');

        let link = `${protocol}://${ip}:${port}/verificarcodigo.html?codigo=${codigo}`;
        // console.log(link)

        await transporter.sendMail({
            from: 'Academic Control',
            to: email,
            subject: 'Recuperação de senha',
            html: `<h1>Olá</h1>
                para recuperar sua senha <a href="${link}" target="_blank">clique aqui</a>
                <h4>Caso não solicitou recuperação de senha favor desconsiderar</h4>`,
            text: ``,
        }).then(res => {
            response.success = true;
        }).catch(erro => console.log(erro))
    } else
        response.data = ["Email nao cadastrado"]
    
    res.send(response)
})

app.post('/verificarcodigo', async (req, res) => {

    let response = {
        success: false,
        data: []
    }

    const { email, senha } = req.body;

    let buff = new Buffer(`${email}=`, 'base64');
    let emailDecoded = buff.toString('ascii');

    const data = await connection('professores')
        .update('SENHA', senha)
        .where('EMAIL', emailDecoded)

    if(data > 0)
        response.success = true;

    res.send(response);

});

app.get('*', (req, res) => {
    res.send(`
        <center><h2>Página não encontrada</center>
    `);
})

app.listen(port, () => console.log(`Servidor iniciado em http://localhost:${port} ou ${protocol}://${ip}:${port}`))
