import React, { useEffect, useState } from 'react';
import { Typography, Table, Button } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import axios from "axios";
import { load } from '@cashfreepayments/cashfree-js';
import { useNavigate, useParams } from 'react-router-dom';
import { saveAs } from "file-saver";
import { pdf } from "@react-pdf/renderer";
import html2canvas from "html2canvas";

const { Text } = Typography;

export default function Ticket() {
    const params = useParams();
    const navigate = useNavigate();

    const [bookedUser, setBookedUser] = useState(null);
    const [bookedTrainSeat, setBookedTrainSeat] = useState(null);
    const [formData, setFormData] = useState({
        name: "",
        title: "",
        location: "",
        date: "",
    });
    const [orderId, setOrderId] = useState("");

    const columns = [
        {
            title: 'Passenger',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Class',
            dataIndex: 'class',
            key: 'class',
        },
        {
            title: 'Quota',
            dataIndex: 'quota',
            key: 'quota',
        },
    ];

    const data = bookedUser
        ? [
            {
                name: bookedUser.name,
                class: bookedUser.seat ? bookedUser.seat.split(" ")[0] : "N/A",
                quota: "GN",
            },
        ]
        : [];

    const htmltoImage = async () => {
        const domElements = document.getElementsByClassName("comments-result");
        const arr = Array.from(domElements);
        const generateImage = async (domElement) => {
            const canvas = await html2canvas(domElement, {
                onclone: (document_1) => {
                    document_1.getElementById("innerDiv").style.display = "block";
                },
                windowWidth: 1600,
            });
            return canvas.toDataURL("image/jpeg", 1.0);
        };
        return Promise.all(arr.map((element) => generateImage(element)));
    };

    let cashfree;

    const initializeSDK = async () => {
        cashfree = await load({ mode: "sandbox" });
    };

    useEffect(() => {
        initializeSDK();
    }, []);

    const getSessionId = async () => {
        try {
            const res = await axios.get("http://localhost:5000/payment");
            if (res.data && res.data.payment_session_id) {
                setOrderId(res.data.order_id);
                return res.data.payment_session_id;
            }
        } catch (error) {
            console.error("Error fetching session ID:", error);
        }
    };

    const verifyPayment = async () => {
        try {
            const res = await axios.post("http://localhost:5000/verify", { orderId });
            if (res && res.data) {
                alert("Payment verified");
            }
        } catch (error) {
            console.error("Error verifying payment:", error);
        }
    };

    const handleClick = async (e) => {
        e.preventDefault();
        try {
            const sessionId = await getSessionId();
            const checkoutOptions = {
                paymentSessionId: sessionId,
                redirectTarget: "_modal",
            };
            cashfree.checkout(checkoutOptions).then(async () => {
                console.log("Payment initialized");
                const updatedSeats = bookedTrainSeat.seats.map((seat) => {
                    if (seat.class === bookedUser?.seat?.split(" ")[0]) {
                        return { ...seat, avail: seat.avail - 1 };
                    }
                    return seat;
                });

                await axios.put(
                    `http://localhost:5000/train/updatetrainseats/${bookedTrainSeat._id}`,
                    {
                        ...bookedTrainSeat,
                        seats: updatedSeats,
                        bookedSeats: bookedTrainSeat.bookedSeats + 1,
                    }
                );

                await htmltoImage();

                import("./pdfGenerator")
                    .then(async (module) => {
                        const PdfFile = module.default;
                        const doc = <PdfFile title="Personal Doc" data={formData} />;
                        const blob = await pdf(doc).toBlob();
                        saveAs(blob, "pdfdoc.pdf");
                    })
                    .catch((error) => console.error("Error generating PDF:", error));

                navigate("/filter-train");
                verifyPayment();
            });
        } catch (error) {
            console.error("Error handling payment:", error);
        }
    };

    useEffect(() => {
        const fetchBookedUser = async () => {
            try {
                const { data } = await axios.get(`http://localhost:5000/user/bookingid/${params.id}`);
                setBookedUser(data);
            } catch (error) {
                console.error("Error fetching booked user:", error);
            }
        };
        fetchBookedUser();
    }, [params.id]);

    useEffect(() => {
        if (bookedUser?.code) {
            const fetchTrain = async () => {
                try {
                    const { data } = await axios.get(`http://localhost:5000/train/getbytraincode/${bookedUser.code}`);
                    setBookedTrainSeat(data);
                } catch (error) {
                    console.error("Error fetching train details:", error);
                }
            };
            fetchTrain();
        }
    }, [bookedUser]);

    return (
        <div className='parent-div1'>
            <div className='id-div1'>
                <div>
                    <Text strong>Ticket Summary</Text>
                    <Text>{bookedUser?.train} - {bookedUser?.code}</Text>
                    <Text>{bookedUser?.source} <ArrowRightOutlined /> {bookedUser?.destination}</Text>
                </div>
                <div>
                    <Text>Available</Text>
                    <Text type='success'>GNWL178/WL52</Text>
                    <Text>Boarding Date: Fri, 13 Dec</Text>
                </div>
            </div>
            <div className='id-div2'>
                <Text>Journey Date: Fri, 13 Dec</Text>
            </div>
            <div className='id-div2'>
                <Table style={{ width: 600 }} columns={columns} dataSource={data} />
            </div>
            <div className='id-div2'>
                <Text strong>Pay Amount</Text>
                <Text strong>₹{bookedUser?.seat?.split(" ")[1] || "N/A"}</Text>
            </div>
            <div className='id-div2'>
                <Button type='primary' onClick={handleClick} block>Proceed to pay</Button>
            </div>
        </div>
    );
}
